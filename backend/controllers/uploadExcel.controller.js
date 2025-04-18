const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const pool = require("../db");
const format = require("pg-format");
const propertyColumnTypes = require("../utils/columnTypes");

function excelDateToTimestamp(serial) {
  if (typeof serial !== "number") return serial;

  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);

  const fractional_day = serial - Math.floor(serial);
  const total_seconds = Math.round(86400 * fractional_day);
  const hours = Math.floor(total_seconds / 3600);
  const minutes = Math.floor((total_seconds % 3600) / 60);
  const seconds = total_seconds % 60;

  return new Date(
    date_info.getFullYear(),
    date_info.getMonth(),
    date_info.getDate(),
    hours,
    minutes,
    seconds
  )
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

const normalizeValue = (value, dataType) => {
  if (
    value === "" ||
    value === "NULL" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (dataType === "TIMESTAMP") {
    return excelDateToTimestamp(value);
  }

  if (dataType === "BOOLEAN") {
    const val = String(value).toLowerCase().trim();
    if (["true", "1", "yes"].includes(val)) return true;
    if (["false", "0", "no"].includes(val)) return false;
    return null;
  }

  if (dataType === "INTEGER") {
    return parseInt(value, 10);
  }

  if (["FLOAT", "DOUBLE PRECISION", "DECIMAL", "NUMERIC"].includes(dataType)) {
    return parseFloat(value);
  }

  if (dataType === "UUID") {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(value)) {
      throw new Error(`Invalid UUID: ${value}`);
    }
    return value;
  }

  return value;
};

exports.validateExcel = async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileName = path
      .basename(filePath, path.extname(filePath))
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], {
      defval: null,
    });
    console.log("Total records read from Excel:", data.length);
    console.log(" JSON Preview:\n", JSON.stringify(data, null, 2));

    // console.log("Data format: ", data);
    if (!data.length) {
      return res.status(400).json({ message: "Excel is empty" });
    }

    const originalHeaders = Object.keys(data[0]);
    const mappedHeaders = originalHeaders.map((h) => ({
      original: h,
      sanitized: h.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    }));

    const columnDefs = mappedHeaders.map((m) => {
      const dataType = propertyColumnTypes[m.sanitized] || "TEXT";
      return `"${m.sanitized}" ${dataType}`;
    });

    const columnNames = mappedHeaders.map((m) => `"${m.sanitized}"`);
    const insertColumns = mappedHeaders.map((m) => m.sanitized);

    // Create table if it doesn't exist
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "${fileName}" (${columnDefs.join(", ")});`
    );

    const invalidRecords = [];
    const values = data.map((row, rowIndex) => {
      try {
        return insertColumns.map((col) => {
          const originalKey = mappedHeaders.find(
            (m) => m.sanitized === col
          )?.original;
          const dataType = propertyColumnTypes[col] || "TEXT";
          const rawValue = row[originalKey];
          const normalized = normalizeValue(rawValue, dataType);
          return normalized;
        });
      } catch (err) {
        console.log(
          `Invalid record at row ${rowIndex + 2}:`, // +2 accounts for Excel header and 0-index
          row,
          "\nReason:",
          err.message
        );
        invalidRecords.push({
          row: rowIndex + 2, // +2 for Excel row offset
          data: row,
          error: err.message,
        });
        return null; // Mark row as invalid
      }
    });

    const validValues = values.filter((v) => v !== null);
    console.log("Valid records:", validValues.length);
    console.log("Invalid records:", invalidRecords.length);

    // Store the validated data in a temporary file for later insertion
    const sessionId =
      Date.now().toString(36) + Math.random().toString(36).substr(2);
    const tempDataPath = path.join(
      __dirname,
      "..",
      "temp",
      `${sessionId}.json`
    );

    // Make sure temp directory exists
    if (!fs.existsSync(path.join(__dirname, "..", "temp"))) {
      fs.mkdirSync(path.join(__dirname, "..", "temp"));
    }

    // Save validation results for later use
    fs.writeFileSync(
      tempDataPath,
      JSON.stringify({
        fileName,
        columnNames,
        values: validValues,
        date: new Date().toISOString(),
      })
    );

    const columnMap = mappedHeaders.reduce((acc, curr) => {
      acc[curr.original] = curr.sanitized;
      return acc;
    }, {});

    // Keep original file for reference, or uncomment to remove it
    // fs.unlinkSync(filePath);

    res.status(200).json({
      message: "Excel validated",
      table: fileName,
      columnMap,
      sessionId,
      total: data.length,
      valid: validValues.length,
      invalid: invalidRecords.length,
      allValid: invalidRecords.length === 0,
      invalidRecords,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error while validating Excel", error: error.message });
  }
};

// Insert data to database after validation
exports.insertData = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    const tempDataPath = path.join(
      __dirname,
      "..",
      "temp",
      `${sessionId}.json`
    );

    if (!fs.existsSync(tempDataPath)) {
      return res
        .status(404)
        .json({ message: "Validation session not found or expired" });
    }

    const sessionData = JSON.parse(fs.readFileSync(tempDataPath));

    // Check if data is still valid (optional: add an expiration check)
    const sessionDate = new Date(sessionData.date);
    const now = new Date();
    if (now - sessionDate > 30 * 60 * 1000) {
      // 30 minutes expiration
      fs.unlinkSync(tempDataPath);
      return res
        .status(400)
        .json({ message: "Validation session expired, please re-upload" });
    }

    // Check if we have any valid records to insert
    if (!sessionData.values.length) {
      return res.status(400).json({ message: "No valid records to insert" });
    }

    // Insert the data
    const insertQuery = format(
      `INSERT INTO "${sessionData.fileName}" (${sessionData.columnNames.join(
        ", "
      )}) VALUES %L`,
      sessionData.values
    );

    const result = await pool.query(insertQuery);

    // Clean up the temp file
    fs.unlinkSync(tempDataPath);

    res.status(200).json({
      message: "Data inserted successfully",
      table: sessionData.fileName,
      inserted: result.rowCount || sessionData.values.length,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error inserting data", error: error.message });
  }
};
