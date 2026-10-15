import { useCallback, useState } from "react";
import { deliveryApi } from "../api/deliveryApi";
import { usePolling } from "../hooks/usePolling";
import { useToast } from "../context/ToastContext";
import {
  Badge,
  DataState,
  Empty,
  Field,
  Live,
  Modal,
  PageHeader,
  Stat,
} from "../components/UI";
import Icon from "../components/Icon";
function DriverForm({ onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notify = useToast();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await deliveryApi.addDriver(
        Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [key, value.trim()]),
        ),
      );
      notify("Driver added and available for deliveries.");
      onSaved();
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add a driver" onClose={onClose}>
      <p className="muted">
        Drivers can serve any restaurant. New drivers start as available.
      </p>
      <form className="form-stack" onSubmit={save}>
        <Field label="Full name">
          <input name="fullName" maxLength={100} required />
        </Field>
        <Field label="Email address">
          <input name="email" type="email" maxLength={255} required />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" maxLength={30} required />
        </Field>
        {error && (
          <div className="error-notice" role="alert">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Adding…" : "Add driver"}
        </button>
      </form>
    </Modal>
  );
}
export default function DriversPage() {
  const query = usePolling(useCallback(() => deliveryApi.drivers(), []));
  const [modal, setModal] = useState(false);
  const drivers = query.data || [];
  return (
    <>
      <PageHeader
        eyebrow="THE PEOPLE BEHIND THE LAST MILE"
        title="Your delivery team"
        actions={
          <>
            <Live {...query} />
            <button className="button primary" onClick={() => setModal(true)}>
              <Icon name="plus" size={18} />
              Add driver
            </button>
          </>
        }
      >
        One shared team for every restaurant. Assignment is managed
        automatically.
      </PageHeader>
      <DataState query={query}>
        <div className="stats-grid three">
          <Stat label="All drivers" value={drivers.length} icon="users" />
          <Stat
            label="Available"
            value={drivers.filter((d) => d.status === "AVAILABLE").length}
            icon="check"
            accent
          />
          <Stat
            label="On assignment"
            value={drivers.filter((d) => d.status === "ASSIGNED").length}
            icon="truck"
          />
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h2>Driver directory</h2>
          </div>
          {!drivers.length ? (
            <Empty title="Your team starts here" icon="users">
              Add at least two drivers to demonstrate simultaneous deliveries.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr key={driver.id}>
                      <td>#{driver.id}</td>
                      <td>
                        <strong>{driver.fullName}</strong>
                      </td>
                      <td>{driver.email}</td>
                      <td>{driver.phone}</td>
                      <td>
                        <Badge status={driver.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </DataState>
      {modal && (
        <DriverForm onClose={() => setModal(false)} onSaved={query.refresh} />
      )}
    </>
  );
}
