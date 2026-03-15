import Link from 'next/link';
import { ArrowRight, DollarSign, Users, TrendingUp } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6">
            ERP <span className="text-primary">Agencia</span>
          </h1>
          <p className="text-xl text-gray-300 mb-12">
            Sistema de gestión financiera diseñado para agencias digitales.
            Controla ventas, pagos y ganancias en un solo lugar.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-black font-bold py-4 px-8 rounded-lg transition-colors text-lg"
          >
            Ingresar al Sistema
            <ArrowRight className="w-5 h-5" />
          </Link>

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            {[
              {
                icon: DollarSign,
                title: 'Control Financiero',
                desc: 'Gestiona ingresos, costos y ganancias en tiempo real',
              },
              {
                icon: Users,
                title: 'Gestión de Clientes',
                desc: 'Administra clientes, ventas y proyectos en un solo lugar',
              },
              {
                icon: TrendingUp,
                title: 'Reportes Detallados',
                desc: 'Visualiza métricas y reportes mensuales automáticos',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10"
              >
                <feature.icon className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}