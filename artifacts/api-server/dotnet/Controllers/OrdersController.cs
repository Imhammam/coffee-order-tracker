using CoffeeOrderApi.Data;
using CoffeeOrderApi.Hubs;
using CoffeeOrderApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CoffeeOrderApi.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController(
    OrderDbContext db,
    IHubContext<OrderHub> orderHub) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CoffeeOrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CoffeeOrderDto>>> ListActiveOrders(
        CancellationToken cancellationToken)
    {
        var orders = await db.Orders
            .AsNoTracking()
            .Include(order => order.Items)
            .Where(order => order.Status != OrderStatus.Completed)
            .OrderBy(order => order.Id)
            .ToListAsync(cancellationToken);

        return Ok(orders.Select(CoffeeOrderDto.From).ToList());
    }

    [HttpPost]
    [ProducesResponseType(typeof(CoffeeOrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CoffeeOrderDto>> CreateOrder(
        [FromBody] CoffeeOrderInput input,
        CancellationToken cancellationToken)
    {
        if (input.Items is null || input.Items.Count == 0)
        {
            return BadRequest(new { error = "Add at least one item to the order." });
        }

        var orderItems = new List<OrderItem>();
        foreach (var item in input.Items)
        {
            var menuItem = MenuCatalog.Find(item.Name);
            if (menuItem is null)
            {
                return BadRequest(new { error = $"'{item.Name}' is not on the menu." });
            }

            if (item.Quantity is < 1 or > 20)
            {
                return BadRequest(new { error = "Item quantities must be between 1 and 20." });
            }

            if (item.Price != menuItem.Price)
            {
                return BadRequest(new { error = $"The current price for {menuItem.Name} is {menuItem.Price:0.00}." });
            }

            orderItems.Add(new OrderItem
            {
                Name = menuItem.Name,
                Quantity = item.Quantity,
                Price = menuItem.Price,
            });
        }

        var lastOrderNumber = await db.Orders
            .Select(order => (int?)order.OrderNumber)
            .MaxAsync(cancellationToken) ?? 100;

        var order = new CoffeeOrder
        {
            OrderNumber = lastOrderNumber + 1,
            Status = OrderStatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow,
            TotalPrice = orderItems.Sum(item => item.Price * item.Quantity),
            Items = orderItems,
        };

        db.Orders.Add(order);
        await db.SaveChangesAsync(cancellationToken);

        var response = CoffeeOrderDto.From(order);
        await orderHub.Clients.Group("kitchen")
            .SendAsync("orderCreated", response, cancellationToken);

        return CreatedAtAction(nameof(GetOrder), new { orderId = order.Id }, response);
    }

    [HttpGet("{orderId:int}")]
    [ProducesResponseType(typeof(CoffeeOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CoffeeOrderDto>> GetOrder(
        int orderId,
        CancellationToken cancellationToken)
    {
        var order = await db.Orders
            .AsNoTracking()
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(candidate => candidate.Id == orderId, cancellationToken);

        return order is null ? NotFound() : Ok(CoffeeOrderDto.From(order));
    }

    [HttpPatch("{orderId:int}/status")]
    [ProducesResponseType(typeof(CoffeeOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CoffeeOrderDto>> UpdateOrderStatus(
        int orderId,
        [FromBody] OrderStatusInput input,
        CancellationToken cancellationToken)
    {
        var order = await db.Orders
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(candidate => candidate.Id == orderId, cancellationToken);

        if (order is null)
        {
            return NotFound();
        }

        var nextIsValid = (order.Status, input.Status) switch
        {
            (OrderStatus.Pending, OrderStatus.Preparing) => true,
            (OrderStatus.Preparing, OrderStatus.Ready) => true,
            (OrderStatus.Ready, OrderStatus.Completed) => true,
            _ => false,
        };

        if (!nextIsValid)
        {
            return BadRequest(new
            {
                error = $"Order {order.OrderNumber} cannot move from {order.Status} to {input.Status}.",
            });
        }

        order.Status = input.Status;
        if (input.Status == OrderStatus.Ready)
        {
            order.ReadyAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
        var response = CoffeeOrderDto.From(order);

        await orderHub.Clients.Group("kitchen")
            .SendAsync("orderStatusUpdated", response, cancellationToken);
        await orderHub.Clients.Group(OrderHub.OrderGroup(order.Id))
            .SendAsync("orderStatusUpdated", response, cancellationToken);

        return Ok(response);
    }
}
