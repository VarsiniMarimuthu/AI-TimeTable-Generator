import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import { BookOpen, Users, MapPin } from 'lucide-react';

export default function Dashboard() {
    const stats = [
        { title: "Total Lectures", count: 24, color: "from-blue-500 to-cyan-400", icon: BookOpen },
        { title: "Active Tutors", count: 12, color: "from-emerald-500 to-teal-400", icon: Users },
        { title: "Rooms Available", count: 8, color: "from-amber-500 to-orange-400", icon: MapPin },
    ];

    return (
        <Layout title="Dashboard Overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {stats.map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{
                            scale: 1.05,
                            rotateY: 5,
                            rotateX: -2,
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)"
                        }}
                        className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 flex items-center justify-between overflow-hidden relative group cursor-pointer"
                    >
                        <div className="relative z-10">
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-1">{stat.title}</p>
                            <h3 className="text-4xl font-black text-gray-800 tracking-tight">{stat.count}</h3>
                        </div>
                        <div className={`p-4 rounded-2xl bg-gradient-to-br ${stat.color} text-white shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                            <stat.icon size={28} />
                        </div>
                        {/* Decorative background element */}
                        <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`}></div>
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-16 bg-white p-12 rounded-3xl shadow-2xl border border-gray-50 text-center relative overflow-hidden"
            >
                <div className="relative z-10">
                    <h2 className="text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                        Welcome to AI Timetable Generator
                    </h2>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed">
                        Experience the future of scheduling. Our AI-driven generator creates
                        perfect, conflict-free timetables in seconds.
                    </p>
                    <div className="mt-10 flex justify-center items-center gap-4">
                        <div className="h-1.5 w-24 bg-gradient-to-r from-blue-500 to-transparent rounded-full opacity-30"></div>
                        <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(147,51,234,0.5)]"></div>
                        <div className="h-1.5 w-24 bg-gradient-to-l from-pink-500 to-transparent rounded-full opacity-30"></div>
                    </div>
                </div>
                {/* 3D-ish background glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50/40 via-white to-purple-50/40 -z-0"></div>
                <div className="absolute -left-20 -top-20 w-64 h-64 bg-blue-100 opacity-20 rounded-full blur-3xl animate-blob"></div>
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-purple-100 opacity-20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
            </motion.div>
        </Layout>
    );
}
