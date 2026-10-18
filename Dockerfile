# استخدام صورة .NET 8 الرسمية للبناء
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# نسخ ملف المشروع واستعادة الحزم (Packages)
COPY artifacts/api-server/dotnet/CoffeeOrderApi.csproj artifacts/api-server/dotnet/
RUN dotnet restore artifacts/api-server/dotnet/CoffeeOrderApi.csproj

# نسخ باقي ملفات الباك إند وعمل النشر (Publish)
COPY artifacts/api-server/dotnet/ artifacts/api-server/dotnet/
WORKDIR /app/artifacts/api-server/dotnet
RUN dotnet publish -c Release -o /out

# مرحلة التشغيل النهائية
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .

# Render بيعطي متغير بيئي PORT، فلازم نخلي التطبيق يستمع عليه
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080}

EXPOSE 8080
ENTRYPOINT ["dotnet", "CoffeeOrderApi.dll"]