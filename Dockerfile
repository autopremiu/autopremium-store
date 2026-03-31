# Usa Node oficial
FROM node:18

# Carpeta de trabajo
WORKDIR /app

# Copia package.json
COPY package*.json ./

# Instala dependencias
RUN npm install

# Copia todo el proyecto
COPY . .

# Expone el puerto
EXPOSE 8080

# Comando para iniciar
CMD ["npm", "start"]


const supabase = createClient(
"https://htuzhjykeqzbqchhzsxa.supabase.co",
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dXpoanlrZXF6YnFjaGh6c3hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAzNDcxNywiZXhwIjoyMDg3NjEwNzE3fQ.EpaS7YvK1mEw6x1_bo0x2SL7Y8pzO6KuGBf_A9TKQwc"
)