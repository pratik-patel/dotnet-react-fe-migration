import type { PropsWithChildren, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

interface MvcLayoutProps {
  footerHostType?: string;
  lead?: ReactNode;
}

function isActive(pathname: string, prefix: string) {
  return pathname.startsWith(prefix);
}

export function MvcLayout({ lead, footerHostType = "local" , children }: PropsWithChildren<MvcLayoutProps>) {
  const location = useLocation();

  return (
    <>
      <div className="navbar navbar-inverse navbar-fixed-top" data-testid="layout-navbar">
        <div className="container">
          <div className="navbar-header">
            <button type="button" className="navbar-toggle" aria-label="Toggle navigation">
              <span className="icon-bar" />
              <span className="icon-bar" />
              <span className="icon-bar" />
            </button>
          </div>

          <div className="navbar-collapse collapse">
            <ul className="nav navbar-nav">
              <li className={isActive(location.pathname, "/Home") ? "active" : ""}>
                <Link to="/Home/Index">Home</Link>
              </li>

              <li className="dropdown" data-testid="layout-sync-dropdown">
                <a href="#" className="dropdown-toggle" onClick={(e) => e.preventDefault()}>
                  Sync database <span className="caret" />
                </a>
                <ul className="dropdown-menu" role="menu">
                  <li><Link to="/Posts/Index">Posts</Link></li>
                  <li><Link to="/Tags/Index">Tags</Link></li>
                  <li className="divider" />
                  <li><Link to="/Blogs/Index">Blogs</Link></li>
                </ul>
              </li>

              <li className="dropdown" data-testid="layout-async-dropdown">
                <a href="#" className="dropdown-toggle" onClick={(e) => e.preventDefault()}>
                  Async database <span className="caret" />
                </a>
                <ul className="dropdown-menu" role="menu">
                  <li><Link to="/PostsAsync/Index">Posts</Link></li>
                  <li><Link to="/TagsAsync/Index">Tags</Link></li>
                </ul>
              </li>

              <li className={isActive(location.pathname, "/Home/About") ? "active" : ""}>
                <Link to="/Home/About">About</Link>
              </li>
              <li className={isActive(location.pathname, "/Home/Contact") ? "active" : ""}>
                <Link to="/Home/Contact">Contact</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container body-content">
        {lead}
        {children}
        <hr />
        <footer className="small text-muted">
          <span>
            An open source project under the <a href="http://opensource.org/licenses/MIT" target="_blank" rel="noreferrer">MIT licence</a>,
            created by <a href="http://www.thereformedprogrammer.net/about-me/" target="_blank" rel="noreferrer">Jon Smith</a>.
          </span>
          <span className="pull-right">Hosted on {footerHostType}</span>
        </footer>
      </div>
    </>
  );
}
