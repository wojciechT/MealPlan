# Builds the SPA and the host into one image: the host serves the built
# frontend from wwwroot outside Development, so a single container is the app.

# --- Frontend ---------------------------------------------------------------
# Debian rather than Alpine: TypeScript 7 and oxlint ship native binaries,
# and glibc is the safe bet for them.
FROM --platform=$BUILDPLATFORM node:24-slim AS frontend
WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# vite.config.ts writes the bundle to ../backend/MealPlan.Host/wwwroot.
RUN npm run build

# --- Backend ----------------------------------------------------------------
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
ARG TARGETARCH
WORKDIR /src

# Project files first, so the restore layer survives source-only changes.
COPY backend/MealPlan.Core/MealPlan.Core.fsproj backend/MealPlan.Core/
COPY backend/MealPlan.Host/MealPlan.Host.csproj backend/MealPlan.Host/
RUN dotnet restore backend/MealPlan.Host/MealPlan.Host.csproj -a $TARGETARCH

COPY backend/ backend/
COPY --from=frontend /src/backend/MealPlan.Host/wwwroot backend/MealPlan.Host/wwwroot
RUN dotnet publish backend/MealPlan.Host/MealPlan.Host.csproj \
    -c Release -a $TARGETARCH --no-restore -o /app

# --- Runtime ----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# The SQLite file lives on a volume, owned by the image's non-root user.
RUN mkdir /data && chown app:app /data
VOLUME /data

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ConnectionStrings__MealPlan="Data Source=/data/mealplan.db"

COPY --from=backend /app ./

USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "MealPlan.Host.dll"]
