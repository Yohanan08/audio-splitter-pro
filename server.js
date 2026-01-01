const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();

// --- CONFIGURACIÓN DE CARPETAS ---
// Esto crea las carpetas automáticamente si no existen al arrancar
const dirs = ["uploads", "output"];
dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

app.use(cors());
app.use(express.json()); // Para que el servidor entienda JSON
app.use(express.urlencoded({ extended: true })); // Para entender datos de formularios
app.use(express.static("public"));

// Esta es la ruta mágica que permite las descargas
app.use("/descargas", express.static(path.join(__dirname, "output")));

// Configuración de Multer (Recepción de archivos)
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// --- RUTA PARA DIVIDIR EL MP3 ---
app.post("/api/split", upload.single("audio"), (req, res) => {
  if (!req.file) return res.status(400).send("No subiste ningún archivo.");

  // Obtenemos el tiempo del formulario, si no, 600seg (10min) por defecto
  const segmentTime = req.body.segmentTime || 600;

  const inputPath = req.file.path;
  const fileName = path.parse(req.file.originalname).name;
  const outputPattern = path.join(
    __dirname,
    "output",
    `${fileName}_part_%03d.mp3`
  );

  console.log(
    `Procesando: ${req.file.originalname} | Segmentos de: ${segmentTime}s`
  );

  ffmpeg(inputPath)
    .outputOptions([
      "-f segment",
      `-segment_time ${segmentTime}`,
      "-c copy", // No procesa audio, solo corta. Es instantáneo.
      "-reset_timestamps 1",
    ])
    .on("error", (err) => {
      console.error("Error FFmpeg:", err);
      res.status(500).json({ error: err.message });
    })
    .on("end", () => {
      console.log("✅ División terminada con éxito.");

      // Listamos los archivos creados en la carpeta output
      const allFiles = fs.readdirSync("output");
      const chunks = allFiles.filter((f) => f.includes(fileName));

      res.json({
        message: "Audio dividido correctamente",
        chunks: chunks,
      });

      // Borramos el archivo original de 'uploads' para no llenar el disco
      fs.unlinkSync(inputPath);
    })
    .save(outputPattern);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});
