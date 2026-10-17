namespace CoffeeOrderApi.Models;

public enum OrderStatus
{
    Pending,
    Preparing,
    Ready,
    Completed,
}

public sealed class CoffeeOrder
{
    public int Id { get; set; }
    public int OrderNumber { get; set; }
    public OrderStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadyAt { get; set; }
    public decimal TotalPrice { get; set; }
    public List<OrderItem> Items { get; set; } = [];
}

public sealed class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string Name { get; set; } = "";
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public CoffeeOrder? Order { get; set; }
}

public sealed record OrderItemDto(int Id, string Name, int Quantity, decimal Price);

public sealed record CoffeeOrderDto(
    int Id,
    int OrderNumber,
    OrderStatus Status,
    DateTimeOffset CreatedAt,
    decimal TotalPrice,
    IReadOnlyList<OrderItemDto> Items)
{
    public static CoffeeOrderDto From(CoffeeOrder order) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.CreatedAt,
            order.TotalPrice,
            order.Items
                .OrderBy(item => item.Id)
                .Select(item => new OrderItemDto(item.Id, item.Name, item.Quantity, item.Price))
                .ToList()
        );
}

public sealed record OrderItemInput(string Name, int Quantity, decimal Price);
public sealed record CoffeeOrderInput(List<OrderItemInput> Items);
public sealed record OrderStatusInput(OrderStatus Status);

public sealed record DashboardSummaryDto(
    int PendingCount,
    int PreparingCount,
    int ReadyCount,
    int CompletedToday,
    double AverageWaitMinutes);

public sealed record MenuItem(string Name, decimal Price, string Category);

public static class MenuCatalog
{
    private static readonly MenuItem[] Items =
    [
        new("Drip coffee", 3.25m, "Coffee"),
        new("Flat white", 4.75m, "Coffee"),
        new("Oat latte", 5.25m, "Coffee"),
        new("Iced matcha", 5.50m, "Coffee"),
        new("Butter croissant", 4.25m, "Bakery"),
        new("Cardamom bun", 4.50m, "Bakery"),
    ];

    public static MenuItem? Find(string name) =>
        Items.FirstOrDefault(item =>
            string.Equals(item.Name, name, StringComparison.OrdinalIgnoreCase));
}
