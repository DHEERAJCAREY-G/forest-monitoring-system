import React from 'react';
import { Link } from 'react-router-dom';
import { 
  TreePine, 
  Flame, 
  ShieldAlert, 
  BarChart3, 
  ArrowRight, 
  Lock, 
  Globe 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: <TreePine className="w-6 h-6 text-emerald-400" />,
      title: "Deforestation Detection",
      description: "Continuous surveillance of canopy changes to identify illegal logging and land degradation."
    },
    {
      icon: <Flame className="w-6 h-6 text-amber-400" />,
      title: "Wildfire Risk Assessment",
      description: "Predictive thermal index monitoring and real-time fire weather metrics to prevent forest fire outbreaks."
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-teal-400" />,
      title: "Early Stage Alerts",
      description: "Automated alert generation for immediate field response and environmental threat mitigation."
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-emerald-400" />,
      title: "Visual Conservation Analytics",
      description: "Interactive environmental reports, spatial charts, and trend analytics supporting wildlife conservation."
    }
  ];

  return (
    <div className="space-y-20 pb-16">
      
      {/* Hero Section */}
      <section className="relative pt-16 pb-8 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto space-y-8">
        
        {/* System Header Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>Interactive Forest Location Monitoring</span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Intelligent Forest Monitoring <br className="hidden sm:inline" />
          <span className="forest-gradient-text">and Conservation System</span>
        </h1>

        {/* Project Objective */}
        <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
          A continuous forest surveillance platform engineered to monitor target coordinates, detect deforestation, assess wildfire risks, and provide early environmental insights.
        </p>

        {/* Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base shadow-xl shadow-emerald-950/60 flex items-center justify-center space-x-2 border border-emerald-400/30 transition-all transform hover:-translate-y-0.5"
            >
              <span>Go to Command Dashboard</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base shadow-xl shadow-emerald-950/60 flex items-center justify-center space-x-2 border border-emerald-400/30 transition-all transform hover:-translate-y-0.5"
              >
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-base border border-slate-700/80 flex items-center justify-center space-x-2 transition-all"
              >
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Account Login</span>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Core Monitoring Capabilities
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Empowering conservationists with location-based environmental surveillance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <div 
              key={idx} 
              className="p-6 rounded-2xl glass-card hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1 space-y-4 group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-100">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
