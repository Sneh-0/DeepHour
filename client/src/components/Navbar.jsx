import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <span className="navbar-brand">Deep-Work Tracker</span>
      <nav className="navbar-links">
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/analytics">Analytics</NavLink>
        <NavLink to="/tags">Tags</NavLink>
      </nav>
      <div className="navbar-user">
        <span className="navbar-name">{user?.name}</span>
        <button className="btn btn-ghost" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  );
}
