FROM golang:1.26-alpine AS build

RUN apk add --no-cache git

WORKDIR /src

RUN git clone --depth 1 https://github.com/dolonet/mtg-multi.git . \
    && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /usr/local/bin/mtg-multi .

FROM alpine:3.21

RUN apk add --no-cache ca-certificates

COPY --from=build /usr/local/bin/mtg-multi /usr/local/bin/mtg-multi
COPY docker/mtproto/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
