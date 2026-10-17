using CoffeeOrderApi.Models;
using Microsoft.EntityFrameworkCore;

namespace CoffeeOrderApi.Data;

public sealed class OrderDbContext(DbContextOptions<OrderDbContext> options) : DbContext(options)
{
    public DbSet<CoffeeOrder> Orders => Set<CoffeeOrder>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CoffeeOrder>(entity =>
        {
            entity.HasKey(order => order.Id);
            entity.HasIndex(order => order.OrderNumber).IsUnique();
            entity.Property(order => order.TotalPrice).HasPrecision(10, 2);
            entity.HasMany(order => order.Items)
                .WithOne(item => item.Order)
                .HasForeignKey(item => item.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Price).HasPrecision(10, 2);
        });
    }
}

public static class SeedData
{
    public static async Task InitializeAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<OrderDbContext>();
        await db.Database.EnsureCreatedAsync();

        if (await db.Orders.AnyAsync())
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        db.Orders.AddRange(
            CreateOrder(101, OrderStatus.Pending, now.AddMinutes(-4), null,
                ("Flat white", 1), ("Butter croissant", 1)),
            CreateOrder(102, OrderStatus.Preparing, now.AddMinutes(-8), null,
                ("Oat latte", 2)),
            CreateOrder(103, OrderStatus.Ready, now.AddMinutes(-11), now.AddMinutes(-5),
                ("Drip coffee", 1), ("Cardamom bun", 1))
        );

        await db.SaveChangesAsync();
    }

    private static CoffeeOrder CreateOrder(
        int orderNumber,
        OrderStatus status,
        DateTimeOffset createdAt,
        DateTimeOffset? readyAt,
        params (string Name, int Quantity)[] lines)
    {
        var items = lines.Select(line =>
        {
            var menuItem = MenuCatalog.Find(line.Name)!;
            return new OrderItem
            {
                Name = menuItem.Name,
                Quantity = line.Quantity,
                Price = menuItem.Price,
            };
        }).ToList();

        return new CoffeeOrder
        {
            OrderNumber = orderNumber,
            Status = status,
            CreatedAt = createdAt,
            ReadyAt = readyAt,
            TotalPrice = items.Sum(item => item.Price * item.Quantity),
            Items = items,
        };
    }
}
