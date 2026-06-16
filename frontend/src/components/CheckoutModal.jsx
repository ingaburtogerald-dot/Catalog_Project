import { useState } from 'react';
import { useCart } from '../context/CartContext';

const initialForm = { name: '', phone: '', delivery: 'pickup', address: '', note: '' };

export default function CheckoutModal() {
  const { isCheckoutOpen, closeCheckout, closeCart, totals, money, submitCheckout, toast } = useCart();
  const [form, setForm] = useState(initialForm);
  const [invalid, setInvalid] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = true;
    if (!form.phone.trim()) errs.phone = true;
    if (form.delivery === 'shipping' && !form.address.trim()) errs.address = true;
    setInvalid(errs);
    if (Object.keys(errs).length) { toast('Completá los campos obligatorios (*)'); return; }

    setSubmitting(true);
    try {
      const order = await submitCheckout({
        name: form.name.trim(), phone: form.phone.trim(), delivery: form.delivery,
        address: form.address.trim(), note: form.note.trim(),
      });
      setForm(initialForm);
      closeCheckout();
      closeCart();
      window.open(order.whatsappUrl, '_blank');
    } catch (err) {
      toast(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="overlay" hidden={!isCheckoutOpen} onClick={closeCheckout}></div>
      <div className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" hidden={!isCheckoutOpen}>
        <div className="checkout-head">
          <h2 id="checkout-title">Tus datos</h2>
          <button className="icon-btn" aria-label="Cerrar" onClick={closeCheckout}>✕</button>
        </div>

        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <label>Nombre completo *
            <input value={form.name} onChange={set('name')} className={invalid.name ? 'invalid' : ''}
              autoComplete="name" placeholder="Ej. Juan Pérez" />
          </label>
          <label>Teléfono / WhatsApp *
            <input value={form.phone} onChange={set('phone')} className={invalid.phone ? 'invalid' : ''}
              inputMode="tel" autoComplete="tel" placeholder="Ej. 8888 8888" />
          </label>
          <fieldset className="co-delivery">
            <legend>¿Cómo querés recibirlo?</legend>
            <label className="radio">
              <input type="radio" name="delivery" value="pickup" checked={form.delivery === 'pickup'} onChange={set('delivery')} /> 🏬 Retiro en tienda
            </label>
            <label className="radio">
              <input type="radio" name="delivery" value="shipping" checked={form.delivery === 'shipping'} onChange={set('delivery')} /> 🚚 Envío a domicilio
            </label>
          </fieldset>
          {form.delivery === 'shipping' && (
            <label>Dirección de entrega *
              <textarea rows="2" value={form.address} onChange={set('address')} className={invalid.address ? 'invalid' : ''}
                placeholder="Barrio, calle, referencias…"></textarea>
            </label>
          )}
          <label>Nota para la tienda (opcional)
            <input value={form.note} onChange={set('note')} placeholder="Color, modelo, horario…" />
          </label>
          <div className="checkout-summary">
            <span>Total a pagar</span><strong>{money(totals.total)}</strong>
          </div>
          <button type="submit" className="btn btn--checkout" disabled={submitting}>
            <i className="fa-brands fa-whatsapp"></i> {submitting ? 'Enviando…' : 'Confirmar y enviar por WhatsApp'}
          </button>
        </form>
      </div>
    </>
  );
}
