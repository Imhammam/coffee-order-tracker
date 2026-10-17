using CoffeeOrderApi.Data;
using CoffeeOrderApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoffeeOrderApi.Controllers;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(OrderDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    [ProducesResponseType(typeof(DashboardSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(
        CancellationToken cancellationToken)
    {
        var orders = await db.Orders.AsNoTracking().ToListAsync(cancellationToken);
        var today = DateTimeOffset.UtcNow.Date;
        var completedToday = orders
            .Where(order => order.Status == OrderStatus.Completed && order.CreatedAt.UtcDateTime.Date == today)
            .ToList();
        var readyToday = orders
            .Where(order => order.ReadyAt.HasValue && order.ReadyAt.Value.UtcDateTime.Date == today)
            .ToList();
        var averageWaitMinutes = readyToday.Count == 0
            ? 0
            : readyToday.Average(order => (order.ReadyAt!.Value - order.CreatedAt).TotalMinutes);

        return Ok(new DashboardSummaryDto(
            orders.Count(order => order.Status == OrderStatus.Pending),
            orders.Count(order => order.Status == OrderStatus.Preparing),
            orders.Count(order => order.Status == OrderStatus.Ready),
            completedToday.Count,
            Math.Round(averageWaitMinutes, 1)
        ));
    }
}
