import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr';
import {
  getGetDashboardSummaryQueryKey,
  getGetOrderQueryKey,
  getListActiveOrdersQueryKey,
  useCreateOrder,
  useGetDashboardSummary,
  useGetOrder,
  useListActiveOrders,
  useUpdateOrderStatus,
} from '@workspace/api-client-react';
import type { CoffeeOrder, CoffeeOrderInput } from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowDownRight, ArrowRight, Bell, Check, CheckCircle2, ChefHat, Circle,
  Clock3, Coffee, Copy, LoaderCircle, Minus, Plus, QrCode, RefreshCw, ShoppingBag,
  Volume2, VolumeX, Wifi, WifiOff, X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const statuses = ['Pending', 'Preparing', 'Ready', 'Completed'] as const;
type OrderStatus = (typeof statuses)[number];

const menu = [
  { name: 'Drip coffee', price: 3.25, note: 'Daily rotating roast', tag: 'HOUSE' },
  { name: 'Flat white', price: 4.75, note: 'Double espresso · silky milk', tag: 'ESPRESSO' },
  { name: 'Oat latte', price: 5.25, note: 'Espresso · oat milk', tag: 'POPULAR' },
  { name: 'Iced matcha', price: 5.5, note: 'Stone-ground · cold whisked', tag: 'CHILLED' },
  { name: 'Butter croissant', price: 4.25, note: 'Baked this morning', tag: 'BAKERY' },
  { name: 'Cardamom bun', price: 4.5, note: 'Our little house favorite', tag: 'BAKERY' },
];

function useOrderRealtime(orderId?: number, joinKitchen = false) {
  const client = useQueryClient();
  const connectionRef = useRef<HubConnection | null>(null);
  useEffect(() => {
    let alive = true;
    const connection = new HubConnectionBuilder()
      .withUrl('/api/hubs/orders')
      .withAutomaticReconnect()
      .build();
    connectionRef.current = connection;
    const refresh = (payload?: unknown) => {
      void client.invalidateQueries({ queryKey: getListActiveOrdersQueryKey() });
      void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      if (orderId !== undefined) void client.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
      const eventOrder = payload as { id?: number; orderId?: number } | undefined;
      const targetId = eventOrder?.id ?? eventOrder?.orderId;
      if (targetId) void client.invalidateQueries({ queryKey: getGetOrderQueryKey(targetId) });
    };
    connection.on('orderCreated', refresh);
    connection.on('orderStatusUpdated', refresh);
    const join = async () => {
      if (connection.state === HubConnectionState.Connected && orderId !== undefined) {
        try {
          await connection.invoke('JoinOrder', orderId);
        } catch (error) {
          console.warn('Could not join order updates', error);
        }
      } else if (connection.state === HubConnectionState.Connected && joinKitchen) {
        try {
          await connection.invoke('JoinKitchen');
        } catch (error) {
          console.warn('Could not join kitchen updates', error);
        }
      }
    };
    connection.onreconnected(async () => {
      await join();
      if (orderId !== undefined) void client.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
      refresh();
    });
    void connection.start().then(() => {
      if (alive) return join();
      return undefined;
    }).catch((error: unknown) => console.warn('Order updates are temporarily unavailable', error));
    return () => {
      alive = false;
      connection.off('orderCreated', refresh);
      connection.off('orderStatusUpdated', refresh);
      void connection.stop();
      connectionRef.current = null;
    };
  }, [client, orderId]);
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const customerPage = location.startsWith('/order/');
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return (
    <div className={`app-shell${customerPage ? ' customer-shell' : ''}`}>
      {!customerPage && (
        <aside className="rail">
          <Link href="/cashier" className="brand" data-testid="link-brand">
            <span className="brand-mark"><Coffee size={20} strokeWidth={1.8} /></span>
            <span className="brand-copy"><b>Juniper</b><small>COFFEE HOUSE</small></span>
          </Link>
          <div className="rail-label">SHIFT TOOLS</div>
          <nav className="rail-nav" aria-label="Main navigation">
            <Link href="/cashier" className={`rail-link ${location === '/cashier' ? 'active' : ''}`} data-testid="link-cashier">
              <ShoppingBag size={17} /><span>New order</span><span className="rail-key">01</span>
            </Link>
            <Link href="/kitchen" className={`rail-link ${location === '/kitchen' ? 'active' : ''}`} data-testid="link-kitchen">
              <ChefHat size={17} /><span>Kitchen</span><span className="rail-key">02</span>
            </Link>
          </nav>
          <div className="rail-bottom">
            <div className="shift-note"><span className="live-dot" /> SERVICE IS LIVE <p>Good coffee, no guesswork.</p></div>
            <div className="rail-foot"><span>NEIGHBORHOOD ROASTERS</span><span>EST. 2018</span></div>
          </div>
        </aside>
      )}
      <main className="main-area">
        {!customerPage && (
          <header className="topbar">
            <div className="topbar-date">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</div>
            <div className="topbar-right">
              <span className={`connection ${online ? 'connected' : 'disconnected'}`}>
                {online ? <Wifi size={14} /> : <WifiOff size={14} />}
                {online ? 'Connected' : 'Offline'}
              </span>
              <span className="top-divider" />
              <div className="user-stamp">JH</div>
            </div>
          </header>
        )}
        {children}
      </main>
    </div>
  );
}

function ShellRouter() {
  const [location] = useLocation();
  const candidateOrderId = location.startsWith('/order/') ? Number(location.split('/')[2]) : undefined;
  const joinKitchen = location === '/' || location === '/cashier' || location === '/kitchen';
  useOrderRealtime(candidateOrderId !== undefined && Number.isFinite(candidateOrderId) ? candidateOrderId : undefined, joinKitchen);
  return (
    <AppShell>
      <RoutedErrorBoundary resetKey={location}>
        <Switch>
          <Route path="/"><CashierPage /></Route>
          <Route path="/cashier"><CashierPage /></Route>
          <Route path="/kitchen"><KitchenPage /></Route>
          <Route path="/order/:orderId"><CustomerPage /></Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppShell>
  );
}

function RoutedErrorBoundary({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  return <ErrorBoundary resetKey={resetKey}>{children}</ErrorBoundary>;
}

function PageHeading({ eyebrow, title, detail, children }: { eyebrow: string; title: string; detail: string; children?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>
      {children}
    </div>
  );
}

function CashierPage() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [created, setCreated] = useState<CoffeeOrder | null>(null);
  const [copied, setCopied] = useState(false);
  const createOrder = useCreateOrder();
  const client = useQueryClient();
  const activeItems = useMemo(() => menu.filter((item) => (cart[item.name] ?? 0) > 0), [cart]);
  const total = activeItems.reduce((sum, item) => sum + item.price * cart[item.name], 0);
  const updateQty = (name: string, delta: number) => {
    setCart((current) => ({ ...current, [name]: Math.max(0, Math.min(20, (current[name] ?? 0) + delta)) }));
  };
  const submitOrder = () => {
    if (!activeItems.length || createOrder.isPending) return;
    const payload: CoffeeOrderInput = { items: activeItems.map((item) => ({ name: item.name, quantity: cart[item.name], price: item.price })) };
    createOrder.mutate({ data: payload }, {
      onSuccess: (order) => {
        setCreated(order);
        setCart({});
        void client.invalidateQueries({ queryKey: getListActiveOrdersQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };
  const customerUrl = created ? `${window.location.origin}/order/${created.id}` : '';
  const copyLink = async () => {
    if (!customerUrl) return;
    try { await navigator.clipboard.writeText(customerUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  const startNext = () => setCreated(null);
  return (
    <div className="page-content cashier-page">
      <PageHeading eyebrow="THE FRONT COUNTER" title="Make it a good one." detail="A fresh ticket, a little ritual. Tap to add it to the queue.">
        <div className="service-pill"><span className="live-dot" /> OPEN FOR ORDERS</div>
      </PageHeading>
      {created ? (
        <section className="success-stage" aria-live="polite">
          <div className="success-copy">
            <div className="success-check"><Check size={24} /></div>
            <span className="eyebrow">TICKET PRINTED · ORDER {created.orderNumber}</span>
            <h2>One lovely order,<br />on its way.</h2>
            <p>Send this page to your customer. Their order updates as it moves through the bar.</p>
            <div className="customer-link" data-testid="text-customer-link"><span>{customerUrl}</span><button onClick={copyLink} data-testid="button-copy-order-link">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy link'}</button></div>
            {import.meta.env.DEV && <div className="preview-note" role="note"><WifiOff size={15} /><span>This private Replit preview link is for testing. Publish the app before sharing the QR with customers.</span></div>}
            <button className="primary-button new-ticket" onClick={startNext} data-testid="button-create-another">Start another order <ArrowRight size={17} /></button>
          </div>
          <div className="ticket-card">
            <div className="ticket-top"><span>JUNIPER / ORDER TICKET</span><span>#{String(created.orderNumber).padStart(3, '0')}</span></div>
            <div className="ticket-rule" />
            <div className="ticket-items">{created.items.map((item) => <div className="ticket-line" key={item.id}><b>{item.quantity}<span>×</span></b><span>{item.name}</span><strong>${(item.price * item.quantity).toFixed(2)}</strong></div>)}</div>
            <div className="ticket-total"><span>TOTAL</span><strong>${created.totalPrice.toFixed(2)}</strong></div>
            <div className="ticket-qr-wrap"><QRCodeSVG value={customerUrl} size={75} bgColor="#ffffff" fgColor="#34271e" level="M" marginSize={1} /><div><b>Follow your order</b><span>Scan to see live updates</span></div></div>
            <a className="ticket-url" href={customerUrl}>{customerUrl}</a>
            <div className="ticket-bottom">MADE WITH CARE, ALWAYS</div>
          </div>
        </section>
      ) : (
        <div className="cashier-layout">
          <section className="menu-panel">
            <div className="section-head"><div><span className="eyebrow">THE COUNTER MENU</span><h2>What sounds good?</h2></div><span className="menu-count">{menu.length} TODAY</span></div>
            <div className="menu-grid">
              {menu.map((item, index) => {
                const count = cart[item.name] ?? 0;
                return <article className={`menu-item ${count ? 'selected' : ''}`} key={item.name} data-testid={`card-menu-item-${index}`}>
                  <div className={`drink-stamp stamp-${index % 4}`}>{index < 4 ? <Coffee size={21} /> : <span className="bakery-mark">J</span>}</div>
                  <div className="menu-item-main"><span className="menu-tag">{item.tag}</span><h3>{item.name}</h3><p>{item.note}</p><strong>${item.price.toFixed(2)}</strong></div>
                  <div className="qty-stepper">
                    {count > 0 && <button onClick={() => updateQty(item.name, -1)} aria-label={`Remove one ${item.name}`} data-testid={`button-decrease-${index}`}><Minus size={14} /></button>}
                    {count > 0 && <span>{count}</span>}
                    <button className={count > 0 ? 'qty-add-added' : ''} onClick={() => updateQty(item.name, 1)} aria-label={`Add ${item.name}`} data-testid={`button-add-${index}`}><Plus size={15} /></button>
                  </div>
                </article>;
              })}
            </div>
          </section>
          <aside className="cart-panel">
            <div className="cart-head"><div><span className="eyebrow">NEW TICKET</span><h2>Order details</h2></div><div className="cart-icon"><ShoppingBag size={17} /></div></div>
            <div className="cart-body">
              {activeItems.length ? activeItems.map((item) => <div className="cart-line" key={item.name}><div><b>{item.name}</b><span>{cart[item.name]} × ${item.price.toFixed(2)}</span></div><strong>${(cart[item.name] * item.price).toFixed(2)}</strong><button onClick={() => setCart((current) => ({ ...current, [item.name]: 0 }))} aria-label={`Remove ${item.name}`} data-testid={`button-remove-${item.name.replaceAll(' ', '-')}`}><X size={14} /></button></div>) :
                <div className="cart-empty"><div className="empty-cup"><Coffee size={24} /></div><b>Your ticket starts here</b><span>Add a drink or something from the oven.</span></div>}
            </div>
            <div className="cart-footer">
              <div className="subtotal"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
              <div className="subtotal tax"><span>Tax included</span><span>—</span></div>
              <div className="cart-total"><span>Total due</span><strong>${total.toFixed(2)}</strong></div>
              {createOrder.isError && <div className="inline-error" role="alert">Couldn’t place this order. Check the connection and try again.</div>}
              <button className="primary-button place-order" onClick={submitOrder} disabled={!activeItems.length || createOrder.isPending} data-testid="button-place-order">
                {createOrder.isPending ? <><LoaderCircle className="spin" size={17} /> Sending ticket…</> : <>Place order <ArrowRight size={17} /></>}
              </button>
              <div className="secure-note"><CheckCircle2 size={13} /> Order syncs instantly with the bar</div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function KitchenPage() {
  const { data: orders, isLoading, isError, refetch } = useListActiveOrders({ query: { queryKey: getListActiveOrdersQueryKey(), refetchInterval: 15000 } });
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 30000 } });
  const updateStatus = useUpdateOrderStatus();
  const client = useQueryClient();
  const [filter, setFilter] = useState<'All' | OrderStatus>('All');
  const { soundOn, toggleSound, playAlert } = useSoundAlerts();
  const previousReady = useRef<number[]>([]);
  useEffect(() => {
    if (!orders) return;
    const readyNow = orders.filter((order) => order.status === 'Ready').map((order) => order.id);
    const justReady = readyNow.filter((id) => !previousReady.current.includes(id));
    if (justReady.length && soundOn) {
      playAlert();
      if ('vibrate' in navigator) navigator.vibrate([120, 60, 180]);
    }
    previousReady.current = readyNow;
  }, [orders, soundOn, playAlert]);
  const visibleOrders = useMemo(() => (orders ?? []).filter((order) => filter === 'All' || order.status === filter)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [orders, filter]);
  const advance = (order: CoffeeOrder) => {
    const next = statuses[statuses.indexOf(order.status as OrderStatus) + 1];
    if (!next) return;
    updateStatus.mutate({ orderId: order.id, data: { status: next } }, {
      onSuccess: (updated) => {
        client.setQueryData(getGetOrderQueryKey(updated.id), updated);
        void client.invalidateQueries({ queryKey: getListActiveOrdersQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };
  return (
    <div className="page-content kitchen-page">
      <PageHeading eyebrow="THE BAR · LIVE QUEUE" title="Good things are brewing." detail="Every ticket, in the order it came in. Keep the rhythm.">
        <button className={`sound-toggle kitchen-sound ${soundOn ? 'sound-on' : ''}`} onClick={toggleSound} data-testid="button-kitchen-sound">
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>{soundOn ? 'Alerts on' : 'Enable alerts'}</span>
        </button>
      </PageHeading>
      <div className="summary-strip">
        <SummaryTile label="Waiting" value={summary?.pendingCount} loading={summaryLoading} tint="cream" icon={<Clock3 size={17} />} />
        <SummaryTile label="On the bar" value={summary?.preparingCount} loading={summaryLoading} tint="sage" icon={<ChefHat size={17} />} />
        <SummaryTile label="Ready to go" value={summary?.readyCount} loading={summaryLoading} tint="gold" icon={<Bell size={17} />} />
        <SummaryTile label="Served today" value={summary?.completedToday} loading={summaryLoading} tint="rose" icon={<CheckCircle2 size={17} />} />
        <div className="wait-summary"><span>AVG. WAIT</span><b>{summaryLoading ? '—' : <>{summary?.averageWaitMinutes ?? '—'}<small> min</small></>}</b><i><ArrowDownRight size={13} /> Smooth sailing</i></div>
      </div>
      <div className="queue-toolbar">
        <div><span className="eyebrow">SERVICE BOARD</span><h2>Active tickets <span>{orders?.length ?? 0}</span></h2></div>
        <div className="queue-tools">
          <div className="filter-tabs" role="tablist" aria-label="Filter orders">
            {(['All', 'Pending', 'Preparing', 'Ready'] as const).map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)} role="tab" aria-selected={filter === item} data-testid={`filter-${item.toLowerCase()}`}>{item}</button>)}
          </div>
          <button className="icon-button" onClick={() => void refetch()} aria-label="Refresh orders" data-testid="button-refresh-orders"><RefreshCw size={16} /></button>
        </div>
      </div>
      {isLoading ? <div className="order-grid">{[1, 2, 3].map((id) => <div className="skeleton-ticket" key={id}><div /><div /><div /></div>)}</div> :
        isError ? <div className="state-panel"><div className="state-icon"><WifiOff size={22} /></div><h3>Queue isn’t coming through.</h3><p>Give the connection a moment, then try again.</p><button className="secondary-button" onClick={() => void refetch()} data-testid="button-retry-orders">Try again <RefreshCw size={15} /></button></div> :
        visibleOrders.length ? <div className="order-grid">
          {visibleOrders.map((order, index) => <OrderCard order={order} key={order.id} index={index} onAdvance={() => advance(order)} updating={updateStatus.isPending && updateStatus.variables?.orderId === order.id} />)}
        </div> :
        <div className="state-panel empty-queue"><div className="state-icon"><Coffee size={23} /></div><span className="eyebrow">{filter === 'All' ? 'A RARE QUIET MOMENT' : `${filter.toUpperCase()} TICKETS`}</span><h3>{filter === 'All' ? 'The board is clear.' : `No ${filter.toLowerCase()} orders right now.`}</h3><p>{filter === 'All' ? 'The next good thing will show up here automatically.' : 'Tickets will appear here as soon as they reach this step.'}</p></div>}
    </div>
  );
}

function SummaryTile({ label, value, loading, tint, icon }: { label: string; value?: number; loading: boolean; tint: string; icon: ReactNode }) {
  return <div className={`summary-tile ${tint}`}><div className="summary-icon">{icon}</div><div><span>{label}</span><b>{loading ? <i className="mini-skeleton" /> : value ?? 0}</b></div></div>;
}

function OrderCard({ order, index, onAdvance, updating }: { order: CoffeeOrder; index: number; onAdvance: () => void; updating: boolean }) {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  const progress = statuses.indexOf(order.status as OrderStatus);
  const action = order.status === 'Pending' ? 'Start preparing' : order.status === 'Preparing' ? 'Mark ready' : order.status === 'Ready' ? 'Complete order' : 'Completed';
  return <article className={`order-card status-${order.status.toLowerCase()}`} style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }} data-testid={`card-order-${order.id}`}>
    <div className="order-card-top"><span className="order-number">#{String(order.orderNumber).padStart(3, '0')}</span><span className="order-age"><span className="live-dot" />{elapsed < 1 ? 'JUST IN' : `${elapsed} MIN`}</span></div>
    <div className="order-status-row"><span className={`status-label ${order.status.toLowerCase()}`}><span />{order.status}</span><span className="order-time">{new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div>
    <div className="order-items">{order.items.map((item) => <div className="order-item" key={item.id}><b>{String(item.quantity).padStart(2, '0')}</b><span>{item.name}</span></div>)}</div>
    <div className="card-progress" aria-label={`Step ${progress + 1} of 4`}>{statuses.map((status, i) => <span key={status} className={i <= progress ? `progress-step reached-${status.toLowerCase()}` : ''} />)}</div>
    {order.status !== 'Completed' ? <button className={`advance-button ${order.status === 'Ready' ? 'ready-action' : ''}`} onClick={onAdvance} disabled={updating} data-testid={`button-advance-${order.id}`}>
      {updating ? <LoaderCircle className="spin" size={16} /> : <>{action}<ArrowRight size={16} /></>}
    </button> : <div className="completed-note"><CheckCircle2 size={15} /> Sent out with a smile</div>}
  </article>;
}

function CustomerPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const { data: order, isLoading, isError, refetch } = useGetOrder(orderId, { query: { enabled: Number.isFinite(orderId) && orderId > 0, queryKey: getGetOrderQueryKey(orderId), refetchInterval: 20000 } });
  const { soundOn, toggleSound, playAlert } = useSoundAlerts();
  const previousStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!order) return;
    if (previousStatus.current !== null && previousStatus.current !== 'Ready' && order.status === 'Ready') {
      if (soundOn) playAlert();
      if ('vibrate' in navigator) navigator.vibrate([140, 60, 220]);
    }
    previousStatus.current = order.status;
  }, [order, soundOn, playAlert]);
  if (isLoading) return <div className="customer-page"><div className="customer-loading"><div className="loading-orbit" /><span>Finding your cup…</span></div></div>;
  if (isError || !order) return <div className="customer-page"><div className="customer-error"><div className="customer-logo"><Coffee size={20} /> JUNIPER</div><div className="state-icon"><QrCode size={22} /></div><h1>We can’t find that ticket.</h1><p>Double-check the link on your receipt or ask us at the counter.</p><button className="secondary-button" onClick={() => void refetch()} data-testid="button-retry-order">Try again <RefreshCw size={15} /></button><Link href="/cashier" className="customer-back">Back to Juniper</Link></div></div>;
  const currentIndex = statuses.indexOf(order.status as OrderStatus);
  const progressCopy: Record<OrderStatus, { title: string; subtitle: string }> = {
    Pending: { title: 'We’ve got your order.', subtitle: 'The baristas have your ticket. Good things take a moment.' },
    Preparing: { title: 'Made just for you.', subtitle: 'Your drink is being put together with care.' },
    Ready: { title: 'Your order is ready.', subtitle: 'Come on up to the counter — we’ll be right here.' },
    Completed: { title: 'That was a good one.', subtitle: 'Thanks for making Juniper part of your day.' },
  };
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  return <div className="customer-page">
    <header className="customer-header"><Link href="/cashier" className="customer-logo"><span className="customer-brand-mark"><Coffee size={18} /></span>JUNIPER <span className="customer-wordmark-sub">COFFEE HOUSE</span></Link><button className={`customer-sound ${soundOn ? 'sound-on' : ''}`} onClick={toggleSound} data-testid="button-customer-sound">{soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>{soundOn ? 'Sound enabled' : 'Tap to enable sound'}</span></button></header>
    <div className="customer-content">
      <div className="customer-kicker"><span className="live-dot" /> LIVE ORDER TRACKING <span className="customer-dash" /> #{String(order.orderNumber).padStart(3, '0')}</div>
      <section className={`customer-hero customer-status-${order.status.toLowerCase()}`}>
        <div className="customer-art" aria-hidden="true"><div className="cup-steam steam-one" /><div className="cup-steam steam-two" /><div className="cup"><div className="cup-rim" /><div className="cup-logo">J</div><div className="cup-handle" /></div><div className="cup-shadow" /></div>
        <span className="eyebrow">A NOTE FROM THE BAR</span>
        <h1>{progressCopy[order.status as OrderStatus]?.title}</h1>
        <p>{progressCopy[order.status as OrderStatus]?.subtitle}</p>
        {order.status === 'Ready' && <div className="ready-ribbon"><Bell size={14} /> COME PICK IT UP</div>}
      </section>
      <section className="tracking-card">
        <div className="tracking-head"><div><span className="eyebrow">YOUR ORDER</span><h2>On its way to you</h2></div><span className="elapsed-chip"><Clock3 size={14} /> {elapsed < 1 ? 'Just now' : `${elapsed} min ago`}</span></div>
        <div className="tracking-steps">
          {statuses.map((status, index) => <div className={`tracking-step ${index < currentIndex ? 'done' : ''} ${index === currentIndex ? 'current' : ''}`} key={status}>
            <div className="track-marker">{index < currentIndex ? <Check size={14} /> : index === currentIndex ? <span className="current-marker" /> : <Circle size={10} />}</div><div className="track-copy"><b>{status === 'Pending' ? 'Received' : status === 'Preparing' ? 'In preparation' : status === 'Ready' ? 'Ready for pickup' : 'Collected'}</b><span>{index === currentIndex ? 'Happening now' : index < currentIndex ? 'All set' : 'Up next'}</span></div>
            {index < statuses.length - 1 && <div className={`track-line ${index < currentIndex ? 'filled' : ''}`} />}
          </div>)}
        </div>
        <div className="tracking-foot"><div><span className="live-dot" /> Updates arrive automatically</div><span><RefreshCw size={13} /> LIVE</span></div>
      </section>
      <section className="customer-receipt">
        <div className="receipt-head"><span>YOUR CUP, YOUR WAY</span><span>#{String(order.orderNumber).padStart(3, '0')}</span></div>
        <div className="receipt-items">{order.items.map((item) => <div className="receipt-item" key={item.id}><span><b>{item.quantity} ×</b> {item.name}</span><strong>${(item.quantity * item.price).toFixed(2)}</strong></div>)}</div>
        <div className="receipt-total"><span>Total paid</span><strong>${order.totalPrice.toFixed(2)}</strong></div>
      </section>
      <footer className="customer-footer"><span>GOOD COFFEE. GOOD NEIGHBORS.</span><span>JUNIPER COFFEE HOUSE · EST. 2018</span></footer>
    </div>
  </div>;
}

function useSoundAlerts() {
  const [soundOn, setSoundOn] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => () => {
    if (contextRef.current) void contextRef.current.close();
  }, []);

  const toggleSound = useCallback(async () => {
    if (soundOn) {
      setSoundOn(false);
      try { await contextRef.current?.suspend(); } catch {}
      return;
    }

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    try {
      const context = contextRef.current ?? new AudioContextClass();
      contextRef.current = context;
      await context.resume();
      if (context.state !== 'running') return;
      setSoundOn(true);
      playChime(context);
    } catch {}
  }, [soundOn]);

  const playAlert = useCallback(() => {
    const context = contextRef.current;
    if (!soundOn || !context) return;
    void context.resume()
      .then(() => { if (soundOn) playChime(context); })
      .catch(() => {});
  }, [soundOn]);

  return { soundOn, toggleSound, playAlert };
}

function playChime(context: AudioContext) {
  try {
    const now = context.currentTime;
    [659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.13 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.13 + 0.34);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.13);
      oscillator.stop(now + index * 0.13 + 0.36);
    });
  } catch {}
}

function Router() {
  return <Switch><Route component={ShellRouter} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
