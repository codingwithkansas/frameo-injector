FROM --platform=linux/amd64 node:18 AS buildcontext
ADD ./ /src
WORKDIR /src
RUN npm install && npm run build

FROM --platform=linux/amd64 node:18
RUN apt-get update \
    && apt-get install -y curl \
    && curl --output "/tmp/platform-tools-latest-linux.zip" "https://dl.google.com/android/repository/platform-tools_r34.0.5-linux.zip" \
    && unzip -d "/tmp" "/tmp/platform-tools-latest-linux.zip" \
    && ln -s /tmp/platform-tools/adb /usr/bin/adb

# Make default ADBKey - dangerous, should override
RUN adb start-server \
    && adb kill-server

WORKDIR /app
COPY --from=buildcontext /src/package.json /app/package.json
COPY --from=buildcontext /src/dist /app/dist
RUN npm install

ENV VERSION="0.1.0"
ENTRYPOINT ["node"]
CMD ["/app/dist/index.js", "replicate"]