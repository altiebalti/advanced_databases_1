FROM postgres:17-alpine

# Copy SQL to the init directory. It will run automatically
# on the first container startup (when the data dir is empty).
COPY ./setup.sql /docker-entrypoint-initdb.d/01-setup.sql


