import fs from "fs"
import JSZip from "jszip"
import xlsx from "xlsx"

// asegurar carpeta imagenes
if (!fs.existsSync("./imagenes")) {
fs.mkdirSync("./imagenes")
}

// limpiar referencia para usarla como nombre de archivo
function limpiarREF(ref) {
  if (!ref) return ""
  return ref
    .toString()
    .replace(/\/\*/g, "")
    .replace(/\*/g, "")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "")
    .trim()
}

async function extraer() {

const archivo = fs.readFileSync("INVENTARIO_CON_FOTOS.xlsx")

const zip = await JSZip.loadAsync(archivo)

const imagenes = Object.keys(zip.files).filter(f =>
f.startsWith("xl/media/")
)

const workbook = xlsx.readFile("INVENTARIO_CON_FOTOS.xlsx")
const sheet = workbook.Sheets["REPUESTOS"]

const data = xlsx.utils.sheet_to_json(sheet, { range: 6 })

console.log("Imagenes encontradas:", imagenes.length)

let i = 0

for (const fila of data) {

const ref = limpiarREF(fila.REF)

if (!ref) continue
if (!imagenes[i]) break

const buffer = await zip.files[imagenes[i]].async("nodebuffer")

const ruta = `./imagenes/${ref}.jpg`

fs.writeFileSync(ruta, buffer)

console.log("Imagen creada:", ref)

i++


}

}

extraer()
