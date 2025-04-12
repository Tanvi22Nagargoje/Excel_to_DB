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
} from "@mui/material";

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [disableInsert, setDisableInsert] = useState(true);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(
        "http://localhost:5000/api/upload",
        formData
      );
      setResult(res.data);
      setDisableInsert(res.data.invalidRecords.length > 0);
    } catch (err) {
      alert("Upload failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    alert("Insert button clicked! Records inserted on backend.");
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
          Excel to PostgreSQL Upload
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Box mt={2} display="flex" justifyContent="center">
          <Input
            type="file"
            onChange={handleFileChange}
            inputProps={{ accept: ".xlsx, .xls, .csv" }}
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
            {loading ? <CircularProgress size={24} /> : "Upload"}
          </Button>

          <Button
            variant="contained"
            color="success"
            onClick={handleInsert}
            disabled={disableInsert}
            sx={{ minWidth: "120px" }}
          >
            Insert
          </Button>
        </Box>

        {result && (
          <Box mt={5}>
            <Typography variant="subtitle1" align="center">
              <strong>Table Name:</strong> {result.table}
            </Typography>

            {renderTablePreview()}
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default App;
