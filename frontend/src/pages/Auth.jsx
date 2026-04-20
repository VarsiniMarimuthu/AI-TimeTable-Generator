import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, User, Lock, Mail, ChevronDown, Zap, ArrowLeft, Loader2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/api';

export default function Auth() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLogin, setIsLogin] = useState(location.state?.isLogin ?? true);
    const [formData, setFormData] = useState({ username: '', password: '', email: '', role: 'student' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                const res = await loginUser({ username: formData.username, password: formData.password });
                if (res.status === 'success') {
                    localStorage.setItem('user', JSON.stringify(res));
                    navigate('/dashboard');
                }
            } else {
                await registerUser({
                    username: formData.username,
                    password: formData.password,
                    email: formData.email,
                    role: formData.role || 'student'
                });
                alert('Registration Successful! Please Login.');
                setIsLogin(true);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#060410] text-white flex items-center justify-center overflow-hidden relative font-sans selection:bg-[#F50057] selection:text-white">
            
            {/* Background elements matched with Home page */}
            <div className="absolute inset-0 z-0 opacity-[0.12] pointer-events-none" 
                 style={{
                     backgroundImage: `linear-gradient(to right, #ffffff44 1px, transparent 1px), linear-gradient(to bottom, #ffffff44 1px, transparent 1px)`,
                     backgroundSize: '4rem 4rem',
                     maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, transparent 80%)',
                     WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, transparent 80%)'
                 }}
            ></div>

            {/* Glowing Ambient Overlays */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#6200EA] rounded-full mix-blend-screen filter blur-[150px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#F50057] rounded-full mix-blend-screen filter blur-[180px] pointer-events-none" style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite', animationDelay: '1s' }}></div>

            {/* Back Button */}
            <button 
                onClick={() => navigate('/')}
                className="absolute top-8 left-8 z-20 flex items-center gap-2 text-gray-400 hover:text-white px-4 py-2 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
            >
                <ArrowLeft size={20} />
                <span className="font-semibold">Back to Home</span>
            </button>

            {/* Main Auth Container */}
            <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-500">
                
                {/* Logo and Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F50057] to-[#6200EA] flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(245,0,87,0.4)]">
                        <Zap size={32} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        Access the AI Smart Timetable Generator
                    </p>
                </div>

                {/* Glassmorphism Card */}
                <div className="bg-[#110C24]/80 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    
                    {/* Elegant Toggle Switch */}
                    <div className="flex bg-[#060410]/80 rounded-[14px] p-1.5 mb-8 border border-white/5 relative shadow-inner">
                        <div 
                            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-gradient-to-r from-teal-400 to-[#2979FF] rounded-[10px] transition-transform duration-300 shadow-[0_0_15px_rgba(41,121,255,0.4)] ${isLogin ? 'translate-x-0' : 'translate-x-full left-[6px]'}`}
                        ></div>
                        <button 
                            type="button"
                            onClick={() => { setIsLogin(true); setError(''); }} 
                            className={`flex-1 py-3 text-sm font-extrabold z-10 transition-colors duration-300 ${isLogin ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Log In
                        </button>
                        <button 
                            type="button"
                            onClick={() => { setIsLogin(false); setError(''); }} 
                            className={`flex-1 py-3 text-sm font-extrabold z-10 transition-colors duration-300 ${!isLogin ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
                            <div className="w-1.5 h-full rounded-full bg-red-500"></div>
                            <p className="text-sm font-semibold text-red-400">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* Username Input */}
                        <div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User size={18} className="text-gray-500 group-focus-within:text-[#2979FF] transition-colors" />
                                </div>
                                <input
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full bg-[#1A1438]/50 border border-white/10 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#2979FF]/50 focus:border-[#2979FF] block w-full pl-11 p-3.5 transition-all outline-none placeholder-gray-500"
                                    placeholder="Username"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-500 group-focus-within:text-[#2979FF] transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-[#1A1438]/50 border border-white/10 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#2979FF]/50 focus:border-[#2979FF] block w-full pl-11 p-3.5 transition-all outline-none placeholder-gray-500"
                                    placeholder="Password"
                                    required
                                />
                            </div>
                        </div>

                        {/* Sign Up Fields */}
                        {!isLogin && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Email Input */}
                                <div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Mail size={18} className="text-gray-500 group-focus-within:text-[#2979FF] transition-colors" />
                                        </div>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full bg-[#1A1438]/50 border border-white/10 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#2979FF]/50 focus:border-[#2979FF] block w-full pl-11 p-3.5 transition-all outline-none placeholder-gray-500"
                                            placeholder="Email Address"
                                        />
                                    </div>
                                </div>

                                {/* Role Selection */}
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Calendar size={18} className="text-gray-500 group-focus-within:text-[#2979FF] transition-colors" />
                                    </div>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                        className="w-full bg-[#1A1438]/50 border border-white/10 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#2979FF]/50 focus:border-[#2979FF] block w-full pl-11 pr-10 p-3.5 transition-all outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="student">Student (Viewer)</option>
                                        <option value="faculty">Faculty (Generator)</option>
                                        <option value="admin">Admin (Data Entry)</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                        <ChevronDown size={18} className="text-gray-500 group-focus-within:text-[#2979FF]" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            disabled={loading}
                            className="group relative w-full mt-6 bg-white hover:bg-gray-100 text-black font-extrabold py-4 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all flex justify-center items-center gap-2 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {!loading && <span className="absolute top-0 left-[-100%] w-[120%] h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-80 transform skew-x-[-20deg] group-hover:left-[100%] transition-all duration-700 ease-in-out mix-blend-overlay"></span>}
                            
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <span>{isLogin ? 'Log In Securely' : 'Complete Registration'}</span>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer terms */}
                <p className="text-center text-gray-500 text-xs mt-8 font-medium">
                    By continuing, you agree to our <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a> and <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>.
                </p>
            </div>
        </div>
    );
}
