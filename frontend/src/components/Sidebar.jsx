import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, GraduationCap, MapPin, BookOpen, Settings, Calendar, LogOut } from 'lucide-react';

export default function Sidebar() {
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user')) || { username: 'Guest', role: 'Visitor' };

    const menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Departments', icon: BookOpen, path: '/departments', roles: ['admin', 'faculty'] },
        { name: 'Faculty', icon: Users, path: '/faculty', roles: ['admin', 'faculty'] },
        { name: 'Subjects', icon: GraduationCap, path: '/subjects', roles: ['admin', 'faculty'] },
        { name: 'Rooms', icon: MapPin, path: '/rooms', roles: ['admin', 'faculty'] },
        { name: 'Generate Timetable', icon: Settings, path: '/generate', roles: ['faculty'] },
        { name: 'Class Timetables', icon: Calendar, path: '/timetables', roles: ['admin', 'faculty', 'student'] },
        { name: 'All Timetables', icon: Calendar, path: '/all-timetables', roles: ['admin', 'faculty'] },
        { name: 'Faculty Timetable', icon: Calendar, path: '/faculty-timetable', roles: ['admin', 'faculty'] },
    ];

    const filteredItems = menuItems.filter(item => !item.roles || item.roles.includes(user.role));

    return (
        <div className="w-64 bg-orodha-purple text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl z-10">
            {/* User Profile Section */}
            <div className="p-8 flex flex-col items-center border-b border-purple-500/30">
                <div className="w-16 h-16 rounded-full bg-white text-orodha-purple flex items-center justify-center text-2xl font-bold mb-3 border-4 border-white/20">
                    {(user.name || user.username || 'A').charAt(0).toUpperCase()}
                </div>
                <h3 className="font-bold text-lg">{user.name || user.username}</h3>
                <p className="text-purple-200 text-sm capitalize">{user.role}</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 space-y-2 px-4">
                {filteredItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-white text-orodha-purple shadow-lg font-bold translate-x-1'
                                : 'text-purple-100 hover:bg-purple-800 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="p-6 border-t border-purple-500/30">
                <Link to="/" className="flex items-center gap-3 px-4 py-3 border border-white/30 rounded-full hover:bg-white/10 transition justify-center">
                    <LogOut size={18} />
                    <span className="font-medium">LOGOUT</span>
                </Link>
            </div>
        </div>
    );
}
