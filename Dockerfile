# Stage 1: Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Build the application
# Note: Any environment variables needed at build time should be passed as build args or via a .env file
RUN npm run build

# Stage 2: Production stage
FROM nginx:stable-alpine

# Copy the build output from the previous stage to the nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 (standard for Nginx)
EXPOSE 80

# The default nginx command starts the server
CMD ["nginx", "-g", "daemon off;"]
