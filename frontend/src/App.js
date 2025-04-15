import React, { useState, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useDropzone } from "react-dropzone";
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
  Alert,
  Snackbar,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [insertLoading, setInsertLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length) {
      setFile(acceptedFiles[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) {
      setSnackbar({
        open: true,
        message: "Please select a file first",
        severity: "error",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(
        "http://localhost:5000/api/validate",
        formData
      );
      setResult(res.data);

      if (res.data.allValid) {
        setSnackbar({
          open: true,
          message: "All records are valid! You can now insert the data.",
          severity: "success",
        });
      } else {
        setSnackbar({
          open: true,
          message: `Found ${res.data.invalid} invalid records.`,
          severity: "warning",
        });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Upload failed",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = async () => {
    if (!result?.sessionId) {
      setSnackbar({
        open: true,
        message: "Please validate the file first",
        severity: "error",
      });
      return;
    }

    try {
      setInsertLoading(true);
      const res = await axios.post("http://localhost:5000/api/insert", {
        sessionId: result.sessionId,
      });

      setSnackbar({
        open: true,
        message: `Successfully inserted ${res.data.inserted} records!`,
        severity: "success",
      });

      setResult(null);
      setFile(null);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Insertion failed",
        severity: "error",
      });
    } finally {
      setInsertLoading(false);
    }
  };

  const handleDownloadInvalidRecords = () => {
    if (!result?.invalidRecords?.length) return;

    const rows = result.invalidRecords.map((record) => ({
      Row: record.row,
      ...record.data,
      Error: record.error,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invalid Records");
    XLSX.writeFile(workbook, "Invalid_Records.xlsx");
  };

  const renderTablePreview = () => {
    if (!result?.invalidRecords?.length) return null;

    const headers = Object.keys(result.invalidRecords[0].data);

    return (
      <Box mt={4}>
        <Typography variant="h6" color="error" gutterBottom>
          ⚠ Some records are invalid.
        </Typography>

        <Box display="flex" justifyContent="flex-end" mt={2} mb={1}>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDownloadInvalidRecords}
          >
            Download Invalid Records
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Invalid Records Preview
        </Typography>

        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell>
                  <strong>Row</strong>
                </TableCell>
                {headers.map((header, index) => (
                  <TableCell key={index}>
                    <strong>{header}</strong>
                  </TableCell>
                ))}
                <TableCell>
                  <strong>Error</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.invalidRecords.map((record, idx) => (
                <TableRow key={idx} sx={{ backgroundColor: "#fff1f1" }}>
                  <TableCell>
                    <strong>{record.row}</strong>
                  </TableCell>
                  {headers.map((header, i) => (
                    <TableCell key={i}>{record.data[header]}</TableCell>
                  ))}
                  <TableCell sx={{ color: "red" }}>{record.error}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>
    );
  };

  const renderValidationSummary = () => {
    if (!result) return null;

    return (
      <Box mt={3}>
        <Alert severity={result.allValid ? "success" : "warning"}>
          <Typography>
            <strong>Total:</strong> {result.total} | <strong>Valid:</strong>{" "}
            {result.valid} | <strong>Invalid:</strong> {result.invalid}
          </Typography>
        </Alert>
      </Box>
    );
  };

  return (
    <Container maxWidth="md" sx={{ mt: 6, mb: 6 }}>
      <Paper
        elevation={4}
        sx={{ p: 5, borderRadius: 3, backgroundColor: "#fafafa" }}
      >
        <Typography
          variant="h4"
          align="center"
          fontWeight="bold"
          color="primary"
          gutterBottom
        >
          📥 Import Excel to Database
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography>
            <strong>Instructions:</strong>
          </Typography>
          <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
            <li>Upload only .xlsx, .xls, or .csv files.</li>
            <li>First row must contain column headers.</li>
            <li>
              Click <strong>Validate</strong> before inserting.
            </li>
            <li>
              If valid, click <strong>Insert</strong> to save data.
            </li>
          </ul>
        </Alert>

        {/* Dropzone Upload Box */}
        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed #aaa",
            padding: 4,
            borderRadius: 2,
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: isDragActive ? "#f0f8ff" : "#ffffff",
            transition: "0.2s",
          }}
        >
          <input {...getInputProps()} />
          <UploadFileIcon color="primary" fontSize="large" />
          <Typography variant="subtitle1" mt={2}>
            {isDragActive
              ? "Drop the file here..."
              : file
              ? `Selected File: ${file.name}`
              : "Drag & drop a file here, or click to browse"}
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box mt={4} display="flex" justifyContent="center" gap={3}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={loading}
            sx={{ minWidth: "130px" }}
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              "Validate"
            )}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleInsert}
            disabled={!result?.allValid || insertLoading}
            sx={{ minWidth: "130px" }}
          >
            {insertLoading ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              "Insert"
            )}
          </Button>
        </Box>

        {/* Result Summary */}
        {result && (
          <Box mt={5}>
            <Typography variant="subtitle1" align="center">
              <strong>Table Name:</strong> {result.table}
            </Typography>
            {renderValidationSummary()}
            {renderTablePreview()}
          </Box>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;
