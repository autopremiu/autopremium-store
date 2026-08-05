import xlsx from "xlsx"
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://htuzhjykeqzbqchhzsxa.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dXpoanlrZXF6YnFjaGh6c3hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAzNDcxNywiZXhwIjoyMDg3NjEwNzE3fQ.EpaS7YvK1mEw6x1_bo0x2SL7Y8pzO6KuGBf_A9TKQwc"


const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const ARCHIVO = "inventario.xlsx"
const BUCKET = "products"

// limpiar
function limpiar(texto) {
if (!texto) return ""
return texto.toString().trim()
}

// limpiar referencia
function limpiarRef(ref) {
  if (!ref) return ""
  return ref.toString()
    .replace(/\/\*/g, "")   // elimina /*
    .replace(/\*/g, "")     // elimina *
    .replace(/\s+/g, "")    // elimina espacios
    .trim()
}

// slug
function slugify(text) {
return limpiar(text)
.toLowerCase()
.replace(/\s+/g, "-")
.replace(/[^\w-]+/g, "")
}

// 📌 buscar marca
async function obtenerBrandId(nombreMarca) {
if (!nombreMarca) return null

const { data, error } = await supabase
.from("brands")
.select("id")
.ilike("name", nombreMarca)
.limit(1)

if (data && data.length > 0) {
return data[0].id
}

return null
}

// leer excel
const workbook = xlsx.readFile(ARCHIVO)
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const data = xlsx.utils.sheet_to_json(sheet, { defval: "" })
console.log("Primer registro:", data[0])

console.log("Filas encontradas:", data.length)

async function importar() {

let ok = 0
let imgOk = 0
let errores = 0

for (const item of data) {

try {


const ref = limpiarRef(item.Referencia)
if (!ref) continue

const nombre = limpiar(item["Descripción"]) || ref
const precio = Number(item.precio || 0)
const stock = Number(item.Cantidad || 0)
const ubicacion = limpiar(item.L)
const marcaTexto = limpiar(item.MARCA)

// 🔥 obtener id de marca
const brand_id = await obtenerBrandId(marcaTexto)

// 1. crear producto
const { error: errInsert } = await supabase
  .from("products")
  .upsert({
    name: nombre,
    slug: slugify(nombre) + "-" + ref,
    sku: ref,
    price: precio,
    stock: stock,
    location: ubicacion,
    brand_id: brand_id,
    description: nombre,
    short_description: nombre
  }, { onConflict: "sku" })

if (errInsert) {
  console.log("❌ Error producto:", ref, errInsert.message)
  errores++
  continue
}

ok++

// 2. imagen
let ruta = null
const formatos = [".jpg", ".png", ".jpeg", ".webp"]

for (const ext of formatos) {
  const posible = path.join("imagenes", ref + ext)
  if (fs.existsSync(posible)) {
    ruta = posible
    break
  }
}

if (ruta) {

  const buffer = fs.readFileSync(ruta)

  await supabase.storage
    .from(BUCKET)
    .upload(ref + ".jpg", buffer, { upsert: true })

  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${ref}.jpg`

  await supabase.from("products")
    .update({
      thumbnail: url,
      images: [url]
    })
    .eq("sku", ref)

  imgOk++

} else {
  console.log("⚠️ Sin imagen:", ref)
}

console.log("✔", ref)


} catch (err) {


console.log("❌ Error general:", item.Referencia)
console.log("👉", err.message)
errores++


}

}

console.log("========== RESULTADO ==========")
console.log("Productos:", ok)
console.log("Con imagen:", imgOk)
console.log("Errores:", errores)

}

importar()
