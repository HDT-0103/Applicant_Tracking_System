/**
 * @vitest-environment jsdom
 */
/**
 * The modal exists because the previous flow had none.
 *
 * "Send Details" used to post two hardcoded strings — a room and a street
 * address invented in the source — straight to a candidate. The whole point of
 * this dialog is that nothing leaves without a human having typed it and seen
 * it, so that is what these tests hold down.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SendDetailsModal } from "../SendDetailsModal";

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof SendDetailsModal>> = {}) {
  const onSend = vi.fn();
  const onCancel = vi.fn();
  const props = {
    open: true,
    candidateName: "Trần Bảo",
    slotTime: "Sep 1, 2026, 9:30 AM",
    sending: false,
    error: null,
    onCancel,
    onSend,
    ...overrides,
  };
  const view = render(<SendDetailsModal {...props} />);
  return { onSend, onCancel, view, props };
}

const room = () => screen.getByPlaceholderText("Meeting Room 4.02");
const address = () => screen.getByPlaceholderText(/Nguyen Van Cu/);
const sendButton = () => screen.getByRole("button", { name: /Send to candidate/ });

describe("SendDetailsModal", () => {
  it("renders nothing when closed", () => {
    const { view } = setup({ open: false });
    expect(view.container).toBeEmptyDOMElement();
  });

  it("will not send until both fields are filled in", () => {
    const { onSend } = setup();

    expect(sendButton()).toBeDisabled();

    fireEvent.change(room(), { target: { value: "Phòng 4.02" } });
    expect(sendButton()).toBeDisabled(); // address still blank

    fireEvent.change(address(), { target: { value: "227 Nguyễn Văn Cừ" } });
    expect(sendButton()).not.toBeDisabled();

    fireEvent.click(sendButton());
    expect(onSend).toHaveBeenCalledWith("Phòng 4.02", "227 Nguyễn Văn Cừ");
  });

  it("treats whitespace as empty", () => {
    setup();
    fireEvent.change(room(), { target: { value: "   " } });
    fireEvent.change(address(), { target: { value: "   " } });
    expect(sendButton()).toBeDisabled();
  });

  it("trims what it sends", () => {
    const { onSend } = setup();
    fireEvent.change(room(), { target: { value: "  Phòng 4.02  " } });
    fireEvent.change(address(), { target: { value: "  227 NVC  " } });
    fireEvent.click(sendButton());
    expect(onSend).toHaveBeenCalledWith("Phòng 4.02", "227 NVC");
  });

  it("names the candidate and the time being sent", () => {
    setup();
    expect(screen.getByText(/Trần Bảo/)).toBeInTheDocument();
    expect(screen.getByText("Sep 1, 2026, 9:30 AM")).toBeInTheDocument();
  });

  it("clears the fields when reopened for someone else", () => {
    const { view, props } = setup();
    fireEvent.change(room(), { target: { value: "Phòng 4.02" } });

    view.rerender(<SendDetailsModal {...props} open={false} />);
    view.rerender(<SendDetailsModal {...props} open candidateName="Lê An" />);

    // Carrying the last room over is how a wrong address gets mailed to the
    // next candidate without anyone rereading it.
    expect(room()).toHaveValue("");
    expect(sendButton()).toBeDisabled();
  });

  it("blocks a second click while the first send is in flight", () => {
    const { onSend } = setup({ sending: true });
    fireEvent.change(room(), { target: { value: "Phòng 4.02" } });
    fireEvent.change(address(), { target: { value: "227 NVC" } });

    // The label switches to "Sending…", which is also the signal to the user
    // that the click landed and a second one would be a duplicate email.
    const button = screen.getByRole("button", { name: /Sending/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows a failure where the reader is already looking", () => {
    setup({ error: "SMTP refused the message" });
    expect(screen.getByRole("alert")).toHaveTextContent("SMTP refused the message");
  });
});
