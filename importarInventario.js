import xlsx from "xlsx"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
"https://htuzhjykeqzbqchhzsxa.supabase.co",
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dXpoanlrZXF6YnFjaGh6c3hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAzNDcxNywiZXhwIjoyMDg3NjEwNzE3fQ.EpaS7YvK1mEw6x1_bo0x2SL7Y8pzO6KuGBf_A9TKQwc"
)

function slugify(text) {
if (!text) return ""
return text
.toLowerCase()
.trim()
.replace(/\s+/g, "-")
.replace(/[^\w-]+/g, "")
}

function limpiarREF(ref) {
if (!ref) return ""
return ref
.toString()
.replace("/*", "")
.replace(/\s+/g, "")
.trim()
}

const workbook = xlsx.readFile("INVENTARIO_CON_FOTOS.xlsx")
const sheet = workbook.Sheets["REPUESTOS"]

const data = xlsx.utils.sheet_to_json(sheet, { range: 6 })

console.log("Filas encontradas:", data.length)

async function importar() {

let contador = 0

for (const item of data) {

try {

const ref = limpiarREF(item.REF)
const name = (item.Descripcion || "").toString().trim()

// solo ignoramos si no hay referencia
if (!ref) continue

const price = Number(item[" Vlr.Venta"] || item["Vlr.Venta"] || 0)
const stock = Number(item.Cant || 0)

const { error } = await supabase
.from("products")
.insert({
name: name || ref,
slug: slugify(name || ref) + "-" + ref,
sku: ref,
description: name || "",
short_description: name || "",
price: price,
stock: stock
})

if (error) {
console.log("Error con:", ref, error.message)
continue
}

contador++

console.log("Subido:", ref)

} catch (err) {

console.log("Fila con error:", err.message)

}

}

console.log("Importación finalizada. Productos subidos:", contador)

}

importar()
