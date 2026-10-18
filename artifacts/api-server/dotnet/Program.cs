using System.Text.Json.Serialization;
using CoffeeOrderApi.Data;
using CoffeeOrderApi.Hubs;
using Microsoft.EntityFrameworkCore;

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.Services.AddDbContext<OrderDbContext>(options =>
    options.UseSqlite($"Data Source={Path.Combine(AppContext.BaseDirectory, "coffee-orders.db")}"));

// 1. إضافة سياسة CORS للسماح للفرونت إند بالاتصال من أي دومين (مثل الفايربيس)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(origin => true) // يسمح لأي دومين بما فيه الفايربيس والتلفون
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // أساسي جداً لتمرير اتصالات SignalR و WebSockets
    });
});

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSignalR();

var app = builder.Build();

// 2. تفعيل استخدام الـ CORS (يجب أن يكون قبل MapControllers و MapHub)
app.UseCors("AllowAll");

app.MapGet("/api/healthz", () => Results.Ok(new { status = "ok" }));
app.MapControllers();
app.MapHub<OrderHub>("/api/hubs/orders");

await SeedData.InitializeAsync(app.Services);
await app.RunAsync();