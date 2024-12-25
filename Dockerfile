# Stage 1: Build the application
FROM node:18 AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application
FROM node:18-slim AS runner

# Set the working directory
WORKDIR /app

# Install a lightweight process manager for production
RUN npm install -g serve

# Copy only the necessary files from the builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Install production dependencies
RUN npm install --only=production

# Expose the port for the application
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
