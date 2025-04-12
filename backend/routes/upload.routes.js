const express = require("express");
const multer = require("multer");
const router = express.Router();
const uploadExcel = require("../controllers/uploadExcel.controller");

const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

router.post("/upload", upload.single("file"), uploadExcel.uploadExcel);
module.exports = router;
