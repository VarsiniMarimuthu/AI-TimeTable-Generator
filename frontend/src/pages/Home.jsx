import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, Layers, Clock, Zap, Shield, Users, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Home() {
    const features = [
        { icon: Calendar, title: "Smart Scheduling", desc: "AI algorithms ensure zero clashes for faculty and rooms instantly, saving you hours of manual puzzle-solving." },
        { icon: Zap, title: "Real-Time Generation", desc: "Process thousands of combinations and constraints to generate complete, optimized timetables in mere seconds." },
        { icon: Layers, title: "Multi-Constraint Optimization", desc: "Handles complex rules gracefully—parallel labs, consecutive periods, limits, and multi-faculty assignments." },
        { icon: Clock, title: "Dynamic Adjustments", desc: "Intuitive drag-and-drop substitutions and effortless administrative controls make ongoing edits a breeze." },
        { icon: Users, title: "Collaborative Ecosystem", desc: "Assign labs and special courses to multiple faculties concurrently while tracking individual workloads." },
        { icon: Shield, title: "Conflict Resolution", desc: "Proactive warnings and intelligent suggestions keep your schedule totally error-free before they happen." },
    ];

    const text3dStyle = {
        textShadow: `0 1px 0 #cccccc, 
                     0 2px 0 #c9c9c9, 
                     0 3px 0 #bbbbbb, 
                     0 4px 0 #b9b9b9, 
                     0 5px 0 #aaaaaa, 
                     0 6px 1px rgba(0,0,0,.2), 
                     0 0 5px rgba(0,0,0,.2), 
                     0 1px 3px rgba(0,0,0,.4), 
                     0 3px 5px rgba(0,0,0,.3), 
                     0 5px 10px rgba(0,0,0,.35), 
                     0 10px 10px rgba(0,0,0,.3), 
                     0 20px 20px rgba(0,0,0,.25)`
    };

    return (
        <div className="min-h-screen bg-[#060410] text-white overflow-hidden relative font-sans selection:bg-[#F50057] selection:text-white">
            
            {/* Dynamic Background Mesh Grid - Gives a high-tech blueprint feel */}
            <div className="absolute inset-0 z-0 opacity-[0.15] pointer-events-none" 
                 style={{
                     backgroundImage: `linear-gradient(to right, #ffffff44 1px, transparent 1px), linear-gradient(to bottom, #ffffff44 1px, transparent 1px)`,
                     backgroundSize: '4rem 4rem',
                     maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 30%, transparent 90%)',
                     WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 30%, transparent 90%)'
                 }}
            ></div>

            {/* Glowing Ambient Lights - Vastly Improved Color Overlays */}
            {/* Top Left Deep Purple */}
            <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} 
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#6200EA] rounded-full mix-blend-screen filter blur-[150px] pointer-events-none"
            ></motion.div>
            
            {/* Right Vibrance Pink */}
            <motion.div 
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }} 
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-[10%] right-[-15%] w-[700px] h-[700px] bg-[#F50057] rounded-full mix-blend-screen filter blur-[180px] pointer-events-none"
            ></motion.div>
            
            {/* Bottom Left Cool Blue */}
            <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} 
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute bottom-[-10%] left-[20%] w-[800px] h-[800px] bg-[#2979FF] rounded-full mix-blend-screen filter blur-[200px] pointer-events-none"
            ></motion.div>

            <div className="relative z-10 container mx-auto px-6 py-10 pb-32 flex flex-col items-center min-h-screen">
                
                {/* Visual Navbar / Top Logo Area */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full flex justify-between items-center mb-10"
                >
                    <div className="text-xl md:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#F50057] to-[#FF8A65] uppercase flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-lg border border-white/10 backdrop-blur-md">
                            <Calendar size={24} className="text-[#F50057]" />
                        </div>
                        Smart Generator
                    </div>
                </motion.div>

                {/* Hero Section Container with Side Elements */}
                <div className="relative w-full flex items-center justify-center mt-[4vh] mb-20">
                    
                    {/* LEFT FLOATING UI WIDGET */}
                    <motion.div 
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.5, type: "spring" }}
                        className="absolute left-[2%] xl:left-[5%] top-[10%] hidden lg:block w-72 bg-[#110C24]/70 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-white font-bold font-sans">Schedules</h4>
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full border border-green-500/30 uppercase tracking-widest">Active</span>
                        </div>
                        <div className="space-y-4">
                            {[1,2,3].map(i => (
                                <div key={i} className="w-full bg-white/5 rounded-2xl border border-white/5 flex items-center p-3 gap-4 hover:bg-white/10 transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2979FF] to-[#6200EA] flex items-center justify-center shadow-inner">
                                        <Clock size={18} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="w-3/4 h-2.5 bg-white/30 rounded-full mb-2"></div>
                                        <div className="w-1/2 h-2 bg-white/10 rounded-full"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* MAIN CENTERED HERO CONTENT */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
                        className="text-center w-full flex flex-col items-center max-w-4xl z-30"
                    >
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-2 mb-8 px-5 py-2 rounded-full border border-[#F50057]/50 bg-[#F50057]/10 backdrop-blur-xl shadow-[0_0_20px_rgba(245,0,87,0.2)]"
                        >
                            <span className="w-2 h-2 rounded-full bg-[#F50057] animate-ping"></span>
                            <span className="text-sm font-bold text-pink-100 uppercase tracking-widest">AI Based</span>
                        </motion.div>

                        <motion.div
                            animate={{ y: [-5, 5, -5] }}
                            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                            className="mb-6 relative w-full flex justify-center"
                        >
                            {/* Huge background glow behind the text */}
                            <div className="absolute inset-0 bg-white/10 blur-[100px] rounded-[100%] scale-125 pointer-events-none"></div>
                            
                            <h1 
                                style={text3dStyle} 
                                className="relative text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-white tracking-tighter leading-tight px-4 text-center"
                            >
                                SMART<br/>TIMETABLE
                            </h1>
                        </motion.div>
                        
                        <h2 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-blue-400 to-[#6200EA]">
                                GENERATOR
                            </span>
                        </h2>
                        
                        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-14 leading-relaxed font-light drop-shadow-md px-4">
                            The ultimate AI-driven timetable generation engine. Build perfectly optimized, intelligent schedules for thousands of students and faculty in precisely zero seconds.
                        </p>

                        {/* Action Buttons - Premium shining interactive styling */}
                        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center w-full sm:w-auto px-4 z-40">
                            <Link to="/login" state={{ isLogin: true }} className="w-full sm:w-auto">
                                <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="group relative w-full sm:w-auto px-10 py-5 bg-white text-black font-extrabold rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-3 text-xl"
                                >
                                    {/* Shine effect */}
                                    <span className="absolute top-0 left-[-100%] w-[120%] h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-80 transform skew-x-[-20deg] group-hover:left-[100%] transition-all duration-700 ease-in-out z-10 mix-blend-overlay"></span>
                                    <span className="relative z-20 flex items-center gap-3">
                                        Start Generating
                                        <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                                    </span>
                                </motion.button>
                            </Link>
                            
                            <Link to="/login" state={{ isLogin: false }} className="w-full sm:w-auto">
                                <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="w-full sm:w-auto px-10 py-5 bg-transparent border-2 border-white/20 hover:border-[#F50057] hover:bg-[#F50057]/10 text-white font-bold rounded-2xl backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-3 text-xl shadow-lg"
                                >
                                    <Users size={24} className="text-[#F50057]" />
                                    Department Signup
                                </motion.button>
                            </Link>
                        </div>
                    </motion.div>

                    {/* RIGHT FLOATING UI WIDGET */}
                    <motion.div 
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.7, type: "spring" }}
                        className="absolute right-[2%] xl:right-[5%] top-[25%] hidden lg:block w-72 bg-[#110C24]/70 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20"
                    >
                        <div className="flex items-center gap-5 mb-6">
                            <div className="relative flex-shrink-0">
                                <svg className="w-16 h-16 transform -rotate-90">
                                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="175" strokeDashoffset="0" className="text-[#F50057]" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Zap size={20} className="text-white" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-white font-black text-lg">100% Valid</h4>
                                <p className="text-xs text-gray-400 font-medium">Conflict-free schedule.</p>
                            </div>
                        </div>
                        <div className="w-full bg-[#1D173A] rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 size={24} className="text-green-500" />
                            </div>
                            <span className="text-sm font-bold text-gray-200 leading-tight">Constraints Satisfied</span>
                        </div>
                    </motion.div>

                </div>

                {/* Divider Line */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-10 max-w-6xl"></div>

                {/* Features Wall - Bento Grid Look */}
                <div className="w-full text-left max-w-7xl mt-12 z-20 relative">
                    <div className="text-center mb-16">
                        <h3 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500 mb-4 tracking-tight">
                            Unleash Incredible Capabilities
                        </h3>
                        <p className="text-lg md:text-xl text-gray-400">Everything you need to automate your entire scheduling workflow.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feat, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, delay: idx * 0.1 }}
                                whileHover={{ 
                                    y: -8,
                                    boxShadow: "0 25px 50px -12px rgba(98, 0, 234, 0.4)"
                                }}
                                className="relative overflow-hidden group bg-[#110C24]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 transition-all duration-300 hover:border-[#6200EA]/60 z-10"
                            >
                                {/* Hover background glow flare inside card */}
                                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#6200EA] to-[#F50057] opacity-0 group-hover:opacity-20 blur-[40px] transition-opacity duration-500 -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none"></div>
                                
                                <div className="w-16 h-16 rounded-2xl bg-[#1D173A] border border-white/5 flex items-center justify-center mb-8 relative z-20 group-hover:bg-gradient-to-br from-[#F50057] to-[#1D173A] transition-all duration-500 shadow-lg group-hover:shadow-[0_0_20px_rgba(245,0,87,0.4)]">
                                    <feat.icon size={28} className="text-gray-300 group-hover:text-white transition-colors duration-300" />
                                </div>
                                <h4 className="text-2xl font-bold text-white mb-4 tracking-wide relative z-20 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">{feat.title}</h4>
                                <p className="text-gray-400 text-lg leading-relaxed relative z-20">{feat.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Elegant bottom gradient fade */}
            <div className="absolute bottom-0 w-full h-48 bg-gradient-to-t from-[#060410] to-transparent pointer-events-none z-20"></div>
        </div>
    );
}
