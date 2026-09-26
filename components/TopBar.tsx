/** Top-right corner of every page: "Log out of Kite" whenever a session is live. */
export function TopBar({ loggedIn }: { loggedIn: boolean }) {
  if (!loggedIn) return null;
  return (
    <div className="topbar">
      <form action="/api/kite/logout" method="post">
        <button type="submit" className="nav-logout">
          <span>Log out of Kite</span>
          <span aria-hidden>↗</span>
        </button>
      </form>
    </div>
  );
}
