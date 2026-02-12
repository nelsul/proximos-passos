FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install Go 1.24
ENV GO_VERSION=1.24.0
RUN curl -fsSL https://go.dev/dl/go${GO_VERSION}.linux-$(dpkg --print-architecture).tar.gz | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:/go/bin:${PATH}"
ENV GOPATH="/go"

# Install Node.js 22 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Go tools for VS Code extension
RUN go install golang.org/x/tools/gopls@latest \
    && go install github.com/go-delve/delve/cmd/dlv@latest \
    && go install honnef.co/go/tools/cmd/staticcheck@latest

# Install PostgreSQL client
RUN apt-get update \
    && apt-get install -y postgresql-client \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
