# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Install Python and build tools
RUN apt-get update && apt-get install -y python3 build-essential

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
# This is done separately to take advantage of Docker layer caching.
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Google Cloud Run provides a PORT environment variable, which the app should listen on.
# The default is 8080. Your app already reads this from process.env.PORT.
EXPOSE 8080

# The command to run the application
CMD ["npm", "start"]
