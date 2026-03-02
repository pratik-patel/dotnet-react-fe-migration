FROM mono:6.12.0.182

# Debian Buster repos are EOL — point to archive
RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list \
    && sed -i 's|http://security.debian.org/debian-security|http://archive.debian.org/debian-security|g' /etc/apt/sources.list \
    && sed -i '/buster-updates/d' /etc/apt/sources.list \
    && echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid

RUN apt-get update && apt-get install -y \
    nuget \
    mono-xsp4 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Trust Mono SSL certs
RUN cert-sync /etc/ssl/certs/ca-certificates.crt || true

WORKDIR /app

# Copy solution + all project/package configs for NuGet restore caching
COPY SampleWebApp.sln ./
COPY SampleWebApp/SampleWebApp.csproj ./SampleWebApp/
COPY SampleWebApp/packages.config ./SampleWebApp/
COPY DataLayer/DataLayer.csproj ./DataLayer/
COPY DataLayer/packages.config ./DataLayer/
COPY ServiceLayer/ServiceLayer.csproj ./ServiceLayer/
COPY ServiceLayer/packages.config ./ServiceLayer/
COPY BizLayer/BizLayer.csproj ./BizLayer/
COPY BizLayer/packages.config ./BizLayer/
# Tests packages needed for solution-level restore
COPY Tests/Tests.csproj ./Tests/
COPY Tests/packages.config ./Tests/

# Restore all NuGet packages using the solution (puts packages/ in the right place)
RUN nuget restore SampleWebApp.sln -NonInteractive -PackagesDirectory packages

# Copy all source code
COPY SampleWebApp/ ./SampleWebApp/
COPY DataLayer/ ./DataLayer/
COPY ServiceLayer/ ./ServiceLayer/
COPY BizLayer/ ./BizLayer/

# Build only the web app project (skip Tests)
RUN xbuild /p:Configuration=Release SampleWebApp/SampleWebApp.csproj 2>&1

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
