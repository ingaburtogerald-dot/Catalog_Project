import { EmailStrategy } from './EmailStrategy';

// Las variables VITE_DEV_* solo existen en .env.development.local (excluido del repo
// por *.local en .gitignore). Vite no las incluye en el build de producción — si
// DevStrategy llegara a ejecutarse en prod, ambas variables serían undefined y
// signInWithEmailAndPassword fallaría de forma segura sin exponer credenciales.
export class DevStrategy extends EmailStrategy {
  constructor() {
    super(
      import.meta.env.VITE_DEV_EMAIL,
      import.meta.env.VITE_DEV_PASSWORD,
    );
  }
}
