FROM rust:alpine AS build

ARG TELEMT_REF=3.3.27

RUN apk add --no-cache build-base git musl-dev

WORKDIR /src

RUN git clone --depth 1 --branch "${TELEMT_REF}" https://github.com/telemt/telemt.git . \
    && cargo build --release \
    && cp target/release/telemt /usr/local/bin/telemt

FROM alpine:3.21

RUN apk add --no-cache ca-certificates

COPY --from=build /usr/local/bin/telemt /usr/local/bin/telemt
COPY docker/mtproto/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
