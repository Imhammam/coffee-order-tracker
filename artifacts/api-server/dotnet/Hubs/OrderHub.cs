using CoffeeOrderApi.Data;
using CoffeeOrderApi.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CoffeeOrderApi.Hubs;

public sealed class OrderHub(OrderDbContext db) : Hub
{
    public async Task JoinKitchen()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "kitchen");
    }

    public async Task JoinOrder(int orderId)
    {
        var order = await db.Orders
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(candidate => candidate.Id == orderId);

        if (order is null)
        {
            throw new HubException("Order not found.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, OrderGroup(orderId));
        await Clients.Caller.SendAsync("orderStatusUpdated", CoffeeOrderDto.From(order));
    }

    public static string OrderGroup(int orderId) => $"order-{orderId}";
}
