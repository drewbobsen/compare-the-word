# ==========================================
# STAGE 1: The Builder (Used for Dev & Compiling)
# ==========================================
FROM rust:latest AS builder
WORKDIR /app

# Install cargo-watch so we can use it in development
RUN cargo install cargo-watch

# Copy the source code and build the production release
COPY . .
RUN cargo build --release

# ==========================================
# STAGE 2: The Production Runtime
# ==========================================
# We switch to a microscopic Debian image that ONLY runs the binary
FROM debian:bookworm-slim AS runner
WORKDIR /app

# Install basic SSL libraries your API might need to make outgoing requests
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy ONLY the compiled binary from Stage 1. Leave the source code and compiler behind!
COPY --from=builder /app/target/release/bible_api .

# Run the binary
CMD ["./bible_api"]