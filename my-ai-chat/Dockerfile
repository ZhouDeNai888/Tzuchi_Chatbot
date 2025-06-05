FROM node:20-alpine

WORKDIR /app

# Install openssl for potential SSL certificate handling
RUN apk add --no-cache openssl

COPY package*.json ./

RUN npm install

COPY . .

# Create directory for SSL certificates
RUN mkdir -p /app/ssl

RUN npm run build

# Expose both HTTP and HTTPS ports
EXPOSE 80
EXPOSE 443

CMD ["npm", "start"]