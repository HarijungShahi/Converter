FROM node:20-bullseye

# Install LibreOffice and FFmpeg natively
RUN apt-get update && \
    apt-get install -y libreoffice ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the Node.js server
CMD ["node", "src/server.js"]
