import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://htuzhjykeqzbqchhzsxa.supabase.co"
const SUPABASE_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dXpoanlrZXF6YnFjaGh6c3hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAzNDcxNywiZXhwIjoyMDg3NjEwNzE3fQ.EpaS7YvK1mEw6x1_bo0x2SL7Y8pzO6KuGBf_A9TKQwc"

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

const carpeta = "./imagenes"
const bucket = "products"

async function subir() {

const archivos = fs.readdirSync(carpeta)

let ok = 0
let fail = 0

for (const archivo of archivos) {

try {

const ruta = path.join(carpeta, archivo)
const buffer = fs.readFileSync(ruta)

const { error: upErr } = await supabase
.storage
.from(bucket)
.upload(archivo, buffer, { upsert: true })

if (upErr) {
console.log("Error subiendo:", archivo, upErr.message)
fail++
continue
}

const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${archivo}`

const sku = archivo.replace(/.(jpg|jpeg|png|webp)$/i, "")

const { error: dbErr } = await supabase
.from("products")
.update({
thumbnail: url,
images: [url]
})
.eq("sku", sku)

if (dbErr) {
console.log("Error actualizando producto:", sku, dbErr.message)
fail++
continue
}

console.log("Imagen conectada:", sku)
ok++

} catch (err) {

console.log("Error con archivo:", archivo, err.message)
fail++

}

}

console.log("Proceso terminado")
console.log("Imágenes conectadas:", ok)
console.log("Errores:", fail)

}

subir()
