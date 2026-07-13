import mongoose from 'mongoose';

const PremioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del premio es obligatorio']
  },
  descripcion: {
    type: String,
    default: ''
  },
  imagen: {
    type: String,
    default: ''
  },
  valor: {
    type: Number,
    default: null
  },
  posicion: {
    type: String,
    required: [true, 'La posición del premio es obligatoria (ej: 1°, 2° o 1, 2)']
  }
});

const RaffleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'El título es obligatorio'],
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  motivo: {
    type: String,
    required: [true, 'El motivo del sorteo es obligatorio']
  },
  description: {
    type: String,
    required: [true, 'La descripción es obligatoria']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  timezone: {
    type: String,
    default: 'America/Argentina/Buenos_Aires'
  },
  
  // Location
  country: {
    type: String,
    required: [true, 'El país es obligatorio']
  },
  province: {
    type: String,
    required: [true, 'La provincia es obligatoria']
  },
  city: {
    type: String,
    required: [true, 'La ciudad es obligatoria']
  },
  address: {
    type: String,
    default: ''
  },
  lat: {
    type: Number,
    default: null
  },
  lng: {
    type: Number,
    default: null
  },

  // Configuration
  totalTickets: {
    type: Number,
    required: [true, 'La cantidad de boletos es obligatoria'],
    min: [1, 'Debe haber al menos 1 boleto']
  },
  ticketPrice: {
    type: Number,
    required: [true, 'El precio por boleto es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  couponCode: {
    type: String,
    default: null
  },
  creationCost: {
    type: Number,
    default: 0
  },
  maxPerBuyer: {
    type: Number,
    default: 10,
    min: [1, 'El límite por comprador debe ser al menos 1']
  },
  ticketSelectionMode: {
    type: String,
    enum: ['manual', 'auto'],
    default: 'auto'
  },
  soldTickets: {
    type: Number,
    default: 0
  },

  // Payment mode for ticket purchases
  paymentMode: {
    type: String,
    enum: ['rifago', 'manual'],
    default: 'rifago'
  },

  // For manual payment mode: creator's bank/transfer details
  transferInfo: {
    cbu:          { type: String, default: '' },
    alias:        { type: String, default: '' },
    bankName:     { type: String, default: '' },
    instructions: { type: String, default: '' }
  },

  // Creation fee tracking
  creationPaid: {
    type: Boolean,
    default: false
  },
  creationPaymentId: {
    type: String,
    default: null
  },

  // Prizes
  premios: [PremioSchema],

  // Gallery
  image: {
    type: String,
    default: ''
  },
  images: {
    type: [String],
    default: []
  },

  // Status & Date
  status: {
    type: String,
    enum: ['borrador', 'pendiente', 'activo', 'finalizado', 'cancelado'],
    default: 'borrador'
  },
  drawDate: {
    type: Date,
    required: [true, 'La fecha del sorteo es obligatoria']
  },

  // Stats & References
  viewsCount: {
    type: Number,
    default: 0
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  winningNumber: {
    type: Number,
    default: null
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El creador es obligatorio']
  },

  // Legacy field support to prevent breaking other dashboard components
  prize: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Pre-save to auto-generate slug and populate legacy components
RaffleSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .normalize('NFD') // remove accents
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  
  // Keep legacy fields updated for dashboard queries
  if (this.premios && this.premios.length > 0) {
    this.prize = this.premios[0].nombre;
  }
  
  if (this.images && this.images.length > 0 && !this.image) {
    this.image = this.images[0];
  }
  
  next();
});

const Raffle = mongoose.model('Raffle', RaffleSchema);

export default Raffle;
