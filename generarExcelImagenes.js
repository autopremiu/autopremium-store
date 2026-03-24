import xlsx from "xlsx"

const workbook = xlsx.readFile("INVENTARIO_CON_FOTOS.xlsx")
const sheet = workbook.Sheets["REPUESTOS"]

const data = xlsx.utils.sheet_to_json(sheet, { range: 6 })

let resultado = []

for (const item of data) {

const ref = item.REF

if (!ref) continue

const limpio = ref.toString()
.replace("/*","")
.replace(/\s+/g,"")
.trim()

const url = `https://www.google.com/search?tbm=isch&q=${limpio}`

resultado.push({
REF: limpio,
URL_IMAGEN: url
})

}

const nuevo = xlsx.utils.json_to_sheet(resultado)

const wb = xlsx.utils.book_new()
xlsx.utils.book_append_sheet(wb, nuevo, "imagenes")

xlsx.writeFile(wb, "imagenes_productos.xlsx")

console.log("Excel generado: imagenes_productos.xlsx")
