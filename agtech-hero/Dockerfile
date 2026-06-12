# Estágio de construção (Build Stage)
FROM node:20-alpine AS build

# Diretório de trabalho no container
WORKDIR /app

# Adiciona argumentos de construção para injetar variáveis de ambiente do Firebase no build do Vite
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID

# Expõe como variáveis de ambiente para a compilação do Vite
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# Copia arquivos de definição de dependências
COPY package*.json ./

# Instala as dependências (ci é mais seguro/rápido para CI/CD)
RUN npm ci

# Copia os arquivos do projeto
COPY . .

# Executa a build de produção (gera a pasta dist/)
RUN npm run build

# Estágio de produção (Production Stage)
FROM nginx:alpine

# Remove o Nginx config padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copia a configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia o build do estágio anterior
COPY --from=build /app/dist /usr/share/nginx/html

# Expõe a porta 80 do container
EXPOSE 80

# Inicia o servidor Nginx
CMD ["nginx", "-g", "daemon off;"]
