import React, { useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  Container,
  Typography,
  Button,
  Box,
  Input,
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

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null); // Reset result when new file is selected
  };

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
      // Changed endpoint to validation endpoint
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
          message: `Found ${res.data.invalid} invalid records. Please fix and re-upload.`,
          severity: "warning",
        });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Upload failed",
        severity: "error",
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = async () => {
    if (!result || !result.sessionId) {
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

      // Reset result to force user to validate again for next insertion
      setResult(null);
      setFile(null);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Insertion failed",
        severity: "error",
      });
      console.error(err);
    } finally {
      setInsertLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
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
          ⚠ Some records are invalid. Please update the file and re-upload.
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
              <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
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
                <TableRow key={idx} sx={{ backgroundColor: "#ffe6e6" }}>
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
      <Box
        mt={3}
        display="flex"
        justifyContent="center"
        gap={2}
        flexWrap="wrap"
      >
        <Alert
          severity={result.allValid ? "success" : "warning"}
          sx={{ width: "100%" }}
        >
          <Typography variant="body1">
            <strong>Total Records:</strong> {result.total} |
            <strong> Valid:</strong> {result.valid} |<strong> Invalid:</strong>{" "}
            {result.invalid}
          </Typography>
        </Alert>
      </Box>
    );
  };

  return (
    <Container maxWidth="md" sx={{ mt: 6, mb: 6 }}>
      <Paper elevation={4} sx={{ p: 5, borderRadius: 3 }}>
        <Typography
          variant="h4"
          gutterBottom
          align="center"
          fontWeight="bold"
          color="primary"
        >
          Import Data From Excel to DB
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Box mt={2} display="flex" justifyContent="center">
          <Input
            type="file"
            onChange={handleFileChange}
            inputProps={{ accept: ".xlsx, .xls, .csv" }}
            value={file ? undefined : ""}
          />
        </Box>

        <Box mt={3} display="flex" justifyContent="center" gap={3}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={loading}
            sx={{ minWidth: "120px" }}
          >
            {loading ? <CircularProgress size={24} /> : "Validate"}
          </Button>

          <Button
            variant="contained"
            color="success"
            onClick={handleInsert}
            disabled={!result || !result.allValid || insertLoading}
            sx={{ minWidth: "120px" }}
          >
            {insertLoading ? <CircularProgress size={24} /> : "Insert"}
          </Button>
        </Box>

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
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;
