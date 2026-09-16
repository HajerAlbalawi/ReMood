import { useGetRecommendationStats, getGetRecommendationStatsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WeatherBackground } from "@/components/weather/WeatherBackground";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Cell as PieCell } from "recharts";
import { Library, CloudRain, Smile } from "lucide-react";

const COLORS = ['#fbbf24', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fb923c'];

export default function Stats() {
  const { data: stats, isLoading, isError } = useGetRecommendationStats({
    query: { queryKey: getGetRecommendationStatsQueryKey() }
  });

  return (
    <AppLayout>
      <WeatherBackground conditionGroup="Clouds" />
      
      <div className="relative z-10 w-full min-h-screen px-4 py-12 md:px-8 max-w-6xl mx-auto">
        <header className="mb-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-amber-500 font-serif"
          >
            إحصائيات القراءة
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mt-2"
          >
            تحليل لرحلتك مع الكتب والطقس
          </motion.p>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError || !stats ? (
          <div className="text-center text-red-400 glass-panel p-8 rounded-2xl">
            عذراً، لم نتمكن من جلب الإحصائيات.
          </div>
        ) : stats.totalRecommendations === 0 ? (
          <div className="text-center text-muted-foreground glass-panel p-12 rounded-2xl flex flex-col items-center gap-4">
            <Library className="w-12 h-12 opacity-20" />
            <p>لا توجد بيانات كافية لعرض الإحصائيات. قم بتجربة المرشد أولاً!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Summary Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-6 rounded-2xl flex items-center justify-between col-span-1 lg:col-span-2"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <Library className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg text-white/70">إجمالي التوصيات</h3>
                  <p className="text-3xl font-bold text-white">{stats.totalRecommendations}</p>
                </div>
              </div>
            </motion.div>

            {/* Top Categories */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-6 rounded-2xl h-[400px] flex flex-col"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary">
                <Library className="w-5 h-5" /> التصنيفات المفضلة
              </h3>
              <div className="flex-1 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topCategories} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="category" type="category" width={150} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {stats.topCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Top Moods */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-6 rounded-2xl h-[400px] flex flex-col"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary">
                <Smile className="w-5 h-5" /> الحالات المزاجية
              </h3>
              <div className="flex-1 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.topMoods}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="mood"
                      labelLine={false}
                    >
                      {stats.topMoods.map((entry, index) => (
                        <PieCell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {stats.topMoods.slice(0, 4).map((mood, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-white/70">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[(idx + 2) % COLORS.length] }} />
                    <span className="truncate max-w-[100px]" title={mood.mood}>{mood.mood}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Weather Breakdown */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-6 rounded-2xl lg:col-span-2 h-[350px] flex flex-col"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary">
                <CloudRain className="w-5 h-5" /> الطقس أثناء القراءة
              </h3>
              <div className="flex-1 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weatherBreakdown} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="condition" tick={{ fill: 'rgba(255,255,255,0.7)' }} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.weatherBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
