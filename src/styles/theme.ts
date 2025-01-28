export const commonStyles = {
  // Layout containers
  pageContainer: "min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 relative overflow-hidden",
  contentContainer: "relative z-10",
  
  // Cards and panels
  card: "relative bg-black/30 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 rounded-xl",
  cardWithHover: "relative bg-black/30 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 rounded-xl hover:bg-black/40 transition-colors duration-200",
  
  // Gradient borders and effects
  gradientBorder: {
    wrapper: "relative",
    gradient: "absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-20",
  },

  // Form elements
  input: "block w-full appearance-none rounded-lg border border-white/5 bg-black/20 px-3 py-2 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm backdrop-blur-xl transition-colors text-white",
  label: "block text-sm font-medium text-gray-200",
  
  // Buttons
  buttonPrimary: {
    wrapper: "relative w-full group",
    gradient: "absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-200",
    content: "relative flex w-full justify-center rounded-lg border border-transparent bg-black py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200",
  },
  buttonSecondary: "px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors",
  
  // Text styles
  heading: "text-2xl font-bold text-white",
  subheading: "text-lg font-medium text-gray-200",
  text: "text-gray-300",
  
  // Status indicators
  badge: {
    success: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 ring-1 ring-inset ring-green-500/20",
    warning: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 ring-1 ring-inset ring-yellow-500/20",
    error: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20",
    info: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20",
  },

  // Background patterns
  patterns: {
    dots: { backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' },
    grid: "bg-[linear-gradient(to_right,rgba(55,65,81,0)_1px,transparent_1px),linear-gradient(to_bottom,rgba(55,65,81,0)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]",
  },

  // Animations
  animate: {
    blob: "animate-blob",
    pulse: "animate-pulse",
    float: "animate-float",
    glow: "animate-glow",
  },

  // Message boxes
  messageBox: {
    error: "rounded-lg bg-red-500/10 p-4 backdrop-blur-sm ring-1 ring-red-500/50 text-red-200",
    success: "rounded-lg bg-green-500/10 p-4 backdrop-blur-sm ring-1 ring-green-500/50 text-green-200",
    warning: "rounded-lg bg-yellow-500/10 p-4 backdrop-blur-sm ring-1 ring-yellow-500/50 text-yellow-200",
    info: "rounded-lg bg-blue-500/10 p-4 backdrop-blur-sm ring-1 ring-blue-500/50 text-blue-200",
  },
}; 