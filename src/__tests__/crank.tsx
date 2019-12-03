/** @jsx createElement */
import "core-js";
import "mutationobserver-shim";
import {Repeater} from "@repeaterjs/repeater";
import {createElement, Context, Element, Root, View} from "../crank";
import {render} from "../envs/dom";

// NOTE: for some reason MutationRecord.previousSibling and
// MutationRecord.nextSibling are weird, non-node objects in some tests. I have
// no interest in figuring out who goofed right now (maybe me) so we’re just
// ignoring the properties in a custom matcher.
declare global {
	// eslint-disable-next-line no-redeclare
	module jest {
		interface Matchers<R, T> {
			toEqualMutationRecords: (expected: any[]) => R;
		}
	}
}

expect.extend({
	toEqualMutationRecords(received, expected) {
		const empty: MutationRecord = {
			type: "childList",
			target: document.body,
			addedNodes: [] as any,
			removedNodes: [] as any,
			attributeName: null,
			attributeNamespace: null,
			nextSibling: null,
			previousSibling: null,
			oldValue: null,
		};
		const pass = Array.isArray(received) && Array.isArray(expected);
		if (pass) {
			received = received.map((record: any) => ({
				...record,
				previousSibling: null,
				nextSibling: null,
			}));
			expected = expected.map((record: any) => ({
				...empty,
				...record,
				previousSibling: null,
				nextSibling: null,
			}));
			// eslint-disable-next-line jest/no-standalone-expect
			expect(received).toEqual(expected);
		}

		return {pass, message: () => "received or expected is not an array"};
	},
});

describe("render", () => {
	let observer: MutationObserver;
	function observe() {
		observer.observe(document.body, {
			childList: true,
			attributes: true,
			characterData: true,
			subtree: true,
		});
	}

	// taken from https://stackoverflow.com/a/35385518
	function createHTML(innerHTML: string): ChildNode | null {
		var template = document.createElement("template");
		innerHTML = innerHTML.trim();
		template.innerHTML = innerHTML;
		return template.content.firstChild;
	}

	beforeEach(() => {
		observer = new MutationObserver(() => {});
	});

	afterEach(() => {
		render(null, document.body);
		observer.disconnect();
	});

	test("simple", () => {
		observe();
		render(<h1>Hello world</h1>, document.body);
		expect(document.body.innerHTML).toEqual("<h1>Hello world</h1>");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{addedNodes: [createHTML("<h1>Hello world</h1>")]},
		]);
	});

	test("rerender text", () => {
		render(<h1>Hello world 1</h1>, document.body);
		expect(document.body.innerHTML).toEqual("<h1>Hello world 1</h1>");
		observe();
		render(<h1>Hello {"world"} 2</h1>, document.body);
		expect(document.body.innerHTML).toEqual("<h1>Hello world 2</h1>");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{
				type: "characterData",
				target: createHTML("Hello world 2"),
				oldValue: "Hello world 1",
			},
		]);
		render(<h1>Hello world {3}</h1>, document.body);
		expect(document.body.innerHTML).toEqual("<h1>Hello world 3</h1>");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{
				type: "characterData",
				target: createHTML("Hello world 3"),
				oldValue: "Hello world 2",
			},
		]);
	});

	test("rerender different child", () => {
		render(
			<div>
				<h1>Hello world</h1>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><h1>Hello world</h1></div>");
		observe();
		render(
			<div>
				<h2>Hello world</h2>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><h2>Hello world</h2></div>");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{
				target: document.body.firstChild,
				addedNodes: [createHTML("<h2>Hello world</h2>")],
			},
			{
				target: document.body.firstChild,
				removedNodes: [createHTML("<h1>Hello world</h1>")],
			},
		]);
	});

	test("rerender text with children", () => {
		render(<div>Hello world</div>, document.body);
		expect(document.body.innerHTML).toEqual("<div>Hello world</div>");
		observe();
		render(
			<div>
				<span>1</span>
				<span>2</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual(
			"<div><span>1</span><span>2</span></div>",
		);
		expect(observer.takeRecords()).toEqualMutationRecords([
			{
				target: document.body.firstChild,
				addedNodes: [createHTML("<span>1</span>")],
				nextSibling: createHTML("<span>2</span>"),
			},
			{
				target: createHTML("<div><span>1</span><span>2</span></div>"),
				removedNodes: [createHTML("Hello world")],
			},
			{
				target: document.body.firstChild,
				addedNodes: [createHTML("<span>2</span>")],
				previousSibling: createHTML("<span>1</span>"),
			},
		]);
	});

	test("rerender children with text", () => {
		render(
			<div>
				<span>1</span>
				<span>2</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual(
			"<div><span>1</span><span>2</span></div>",
		);
		observe();
		render(<div>Hello world</div>, document.body);
		expect(document.body.innerHTML).toEqual("<div>Hello world</div>");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{
				target: document.body.firstChild,
				addedNodes: [createHTML("Hello world")],
			},
			{
				target: document.body.firstChild,
				removedNodes: [createHTML("<span>1</span>")],
			},
			{
				target: document.body.firstChild,
				removedNodes: [createHTML("<span>2</span>")],
			},
		]);
	});

	test("rerender more children", () => {
		render(
			<div>
				<span>1</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>1</span></div>");
		observe();
		render(
			<div>
				<span>1</span>
				<span>2</span>
				<span>3</span>
				<span>4</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual(
			"<div><span>1</span><span>2</span><span>3</span><span>4</span></div>",
		);
		expect(observer.takeRecords()).toEqualMutationRecords([
			{
				target: document.body.firstChild,
				addedNodes: [createHTML("<span>2</span>")],
			},
			{
				target: document.body.firstChild,
				addedNodes: [createHTML("<span>3</span>")],
			},
			{
				target: document.body.firstChild,
				addedNodes: [createHTML("<span>4</span>")],
			},
		]);
	});

	test("rerender fewer children", () => {
		render(
			<div>
				<span>1</span>
				<span>2</span>
				<span>3</span>
				<span>4</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual(
			"<div><span>1</span><span>2</span><span>3</span><span>4</span></div>",
		);
		observe();
		render(
			<div>
				<span>1</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>1</span></div>");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{
				target: document.body.firstChild,
				removedNodes: [createHTML("<span>2</span>")],
			},
			{
				target: document.body.firstChild,
				removedNodes: [createHTML("<span>3</span>")],
			},
			{
				target: document.body.firstChild,
				removedNodes: [createHTML("<span>4</span>")],
			},
		]);
	});

	test("render null", () => {
		render(<h1>Hello world</h1>, document.body);
		expect(document.body.innerHTML).toEqual("<h1>Hello world</h1>");
		observe();
		render(null, document.body);
		expect(document.body.innerHTML).toEqual("");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{removedNodes: [createHTML("<h1>Hello world</h1>")]},
		]);
		render(<h1>Hello again</h1>, document.body);
		expect(document.body.innerHTML).toEqual("<h1>Hello again</h1>");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{addedNodes: [createHTML("<h1>Hello again</h1>")]},
		]);
		render(null, document.body);
		expect(document.body.innerHTML).toEqual("");
		expect(observer.takeRecords()).toEqualMutationRecords([
			{removedNodes: [createHTML("<h1>Hello again</h1>")]},
		]);
	});

	test("explicit root", () => {
		render(createElement(Root, {node: document.body}, <div>Hello world</div>));
		expect(document.body.innerHTML).toEqual("<div>Hello world</div>");
	});
});

describe("sync function component", () => {
	afterEach(async () => {
		await render(null, document.body);
	});

	test("basic", () => {
		function Component({message}: {message: string}): Element {
			return <span>{message}</span>;
		}

		render(
			<div>
				<Component message="Hello" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Hello</span></div>");
		render(
			<div>
				<Component message="Goodbye" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Goodbye</span></div>");
	});

	test("rerender different return value", () => {
		function Component({ChildTag}: {ChildTag: string}): Element {
			return <ChildTag>Hello world</ChildTag>;
		}

		render(<Component ChildTag="div" />, document.body);
		expect(document.body.innerHTML).toEqual("<div>Hello world</div>");
		render(<Component ChildTag="span" />, document.body);
		expect(document.body.innerHTML).toEqual("<span>Hello world</span>");
	});
});

describe("async function component", () => {
	afterEach(async () => {
		await render(null, document.body);
	});

	test("basic", async () => {
		async function Component({message}: {message: string}): Promise<Element> {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return <span>{message}</span>;
		}

		const viewP = render(
			<div>
				<Component message="Hello" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		await expect(viewP).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello</span></div>");
	});

	test("update batching", async () => {
		const Component = jest.fn(async function Component({
			message,
		}: {
			message: string;
		}): Promise<Element> {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return <span>{message}</span>;
		});

		const viewP1 = render(
			<div>
				<Component message="Hello 1" />
			</div>,
			document.body,
		);
		const viewP2 = render(
			<div>
				<Component message="Hello 2" />
			</div>,
			document.body,
		);
		const viewP3 = render(
			<div>
				<Component message="Hello 3" />
			</div>,
			document.body,
		);
		const viewP4 = render(
			<div>
				<Component message="Hello 4" />
			</div>,
			document.body,
		);
		const viewP5 = render(
			<div>
				<Component message="Hello 5" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		await expect(viewP1).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		await expect(viewP2).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 5</span></div>");
		await expect(viewP3).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 5</span></div>");
		await expect(viewP4).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 5</span></div>");
		const viewP6 = render(
			<div>
				<Component message="Hello 6" />
			</div>,
			document.body,
		);
		const viewP7 = render(
			<div>
				<Component message="Hello 7" />
			</div>,
			document.body,
		);
		const viewP8 = render(
			<div>
				<Component message="Hello 8" />
			</div>,
			document.body,
		);
		const viewP9 = render(
			<div>
				<Component message="Hello 9" />
			</div>,
			document.body,
		);
		const viewP10 = render(
			<div>
				<Component message="Hello 10" />
			</div>,
			document.body,
		);
		await expect(viewP5).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 5</span></div>");
		await expect(viewP6).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 6</span></div>");
		await expect(viewP7).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 10</span></div>");
		await expect(viewP8).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 10</span></div>");
		await expect(viewP9).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 10</span></div>");
		await expect(viewP10).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 10</span></div>");
		expect(Component).toHaveBeenCalledTimes(4);
	});

	test("update", async () => {
		const resolves: (() => unknown)[] = [];
		async function Component({message}: {message: string}): Promise<Element> {
			await new Promise((resolve) => resolves.push(resolve));
			return <span>{message}</span>;
		}

		let viewP = render(
			<div>
				<Component message="Hello 1" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		resolves[0]();
		await viewP;
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		viewP = render(
			<div>
				<Component message="Hello 2" />
			</div>,
			document.body,
		);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		resolves[1]();
		await viewP;
		expect(document.body.innerHTML).toEqual("<div><span>Hello 2</span></div>");
		expect(resolves.length).toEqual(2);
	});

	test("out of order", async () => {
		async function Component({
			message,
			delay,
		}: {
			message: string;
			delay: number;
		}): Promise<Element> {
			await new Promise((resolve) => setTimeout(resolve, delay));
			return <span>{message}</span>;
		}

		const viewP1 = render(
			<div>
				<Component message="Hello 1" delay={100} />
			</div>,
			document.body,
		);
		const viewP2 = render(
			<div>
				<Component message="Hello 2" delay={0} />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		await viewP1;
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		await viewP2;
		expect(document.body.innerHTML).toEqual("<div><span>Hello 2</span></div>");
	});

	test("race where first wins", async () => {
		const t = Date.now();
		let t1: number;
		let t2: number;
		async function Loading(): Promise<Element> {
			await new Promise((resolve) => setTimeout(resolve, 50));
			t1 = Date.now();
			return <span>Loading...</span>;
		}

		async function Component(): Promise<Element> {
			await new Promise((resolve) => setTimeout(resolve, 100));
			t2 = Date.now();
			return <span>Loaded</span>;
		}

		const viewP1 = render(
			<div>
				<Loading />
			</div>,
			document.body,
		);
		const viewP2 = render(
			<div>
				<Component />
			</div>,
			document.body,
		);
		await viewP1;
		expect(document.body.innerHTML).toEqual(
			"<div><span>Loading...</span></div>",
		);
		await viewP2;
		expect(document.body.innerHTML).toEqual("<div><span>Loaded</span></div>");
		expect(t1! - t).toBeCloseTo(50, -2);
		expect(t2! - t).toBeCloseTo(100, -2);
	});

	test("race where second wins", async () => {
		const promise = new Promise((resolve) => setTimeout(resolve, 100));
		async function Loading(): Promise<Element> {
			await promise;
			return <span>Loading...</span>;
		}

		async function Component(): Promise<Element> {
			await new Promise((resolve) => setTimeout(resolve, 50));
			return <span>Loaded</span>;
		}

		const viewP1 = render(
			<div>
				<Loading />
			</div>,
			document.body,
		);
		const viewP2 = render(
			<div>
				<Component />
			</div>,
			document.body,
		);
		await viewP1;
		expect(document.body.innerHTML).toEqual("<div><span>Loaded</span></div>");
		await viewP2;
		expect(document.body.innerHTML).toEqual("<div><span>Loaded</span></div>");
		await promise;
		expect(document.body.innerHTML).toEqual("<div><span>Loaded</span></div>");
	});
});

describe("sync generator component", () => {
	afterEach(async () => {
		await render(null, document.body);
	});

	test("basic", () => {
		const SyncGen = jest.fn(function*(
			this: Context,
			{message}: {message: string},
		): Generator<Element> {
			let i = 0;
			for ({message} of this) {
				i++;
				if (i > 2) {
					return;
				}

				yield (<span>{message}</span>);
			}
		});

		render(
			<div>
				<SyncGen message="Hello 1" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		render(
			<div>
				<SyncGen message="Hello 2" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 2</span></div>");
		render(
			<div>
				<SyncGen message="Hello 3" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div></div>");
		expect(SyncGen).toHaveBeenCalledTimes(1);
	});

	test("refresh", () => {
		let ctx!: Context;
		function* SyncGen(this: Context): Generator<Element> {
			let i = 1;
			ctx = this;
			// eslint-disable-next-line
			for (const _ of this) {
				yield (<span>Hello {i++}</span>);
			}
		}

		render(
			<div>
				<SyncGen />
			</div>,
			document.body,
		);

		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		ctx.refresh();
		expect(document.body.innerHTML).toEqual("<div><span>Hello 2</span></div>");
		ctx.refresh();
		ctx.refresh();
		expect(document.body.innerHTML).toEqual("<div><span>Hello 4</span></div>");
	});

	test("async children", async () => {
		const mock = jest.fn();
		async function Component({children}: {children: any}): Promise<Element> {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return <span>{children}</span>;
		}

		let ctx!: Context;
		function* Gen(this: Context): Generator<Element> {
			ctx = this;
			let i = 0;
			for (const _ of this) {// eslint-disable-line
				const yielded = yield (<Component>Hello {i++}</Component>);
				mock((yielded as any).outerHTML);
			}
		}

		const p1 = render(
			<div>
				<Gen />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		await p1;
		expect(document.body.innerHTML).toEqual("<div><span>Hello 0</span></div>");
		const p2 = ctx.refresh();
		await Promise.resolve();
		expect(mock).toHaveBeenCalledTimes(1);
		expect(mock).toHaveBeenCalledWith("<span>Hello 0</span>");
		expect(document.body.innerHTML).toEqual("<div><span>Hello 0</span></div>");
		await p2;
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		ctx.refresh();
		await Promise.resolve();
		expect(mock).toHaveBeenCalledTimes(2);
		expect(mock).toHaveBeenCalledWith("<span>Hello 1</span>");
	});
});

describe("async generator component", () => {
	afterEach(async () => {
		await render(null, document.body);
	});

	test("basic", async () => {
		let resolve!: () => unknown;
		const AsyncGen = jest.fn(async function*(
			this: Context,
			{message}: {message: string},
		): AsyncGenerator<Element> {
			for await ({message} of this) {
				yield (<span>Loading</span>);
				await new Promise((resolve1) => (resolve = resolve1));
				yield (<span>{message}</span>);
			}
		});

		const viewP = render(
			<div>
				<AsyncGen message="Hello" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		await expect(viewP).resolves.toBeInstanceOf(View);
		expect(document.body.innerHTML).toEqual("<div><span>Loading</span></div>");
		resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual("<div><span>Hello</span></div>");
		await render(
			<div>
				<AsyncGen message="Goodbye" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Loading</span></div>");
		resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual("<div><span>Goodbye</span></div>");
		expect(AsyncGen).toHaveBeenCalledTimes(1);
	});

	test("multiple updates", async () => {
		let push!: (value: Element) => unknown;
		function Component(): AsyncGenerator<Element> {
			return new Repeater((push1) => (push = push1));
		}

		let p: any = render(
			<div>
				<Component />
			</div>,
			document.body,
		);
		push(<span>Hello 1</span>);
		await p;
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		push(<span>Hello 2</span>);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 2</span></div>");
		push(<span>Hello 3</span>);
		await new Promise((resolve) => setTimeout(resolve, 0));
		push(<span>Hello 4</span>);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 3</span></div>");
	});

	test("async unmount", async () => {
		let cleanup!: () => unknown;
		async function* Component(this: Context, {message}: {message: string}) {
			if (cleanup !== undefined) {
				throw new Error("Rendered component twice");
			}

			try {
				for await ({message} of this) {
					yield (<span>{message}</span>);
				}
			} finally {
				await new Promise((resolve) => (cleanup = resolve));
			}
		}

		await render(
			<div>
				<Component message="Hello 1" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		render(<div />, document.body);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		cleanup();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual("<div></div>");
	});

	test("async unmount preserves hanging children", async () => {
		let cleanup!: () => unknown;
		async function* Component(this: Context, {message}: {message: string}) {
			if (cleanup !== undefined) {
				throw new Error("Rendered component twice");
			}

			try {
				for await ({message} of this) {
					yield (<span>{message}</span>);
				}
			} finally {
				await new Promise((resolve) => (cleanup = resolve));
			}
		}

		await render(
			<div>
				<Component message="Hello 1" />
				<span>Goodbye 1</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual(
			"<div><span>Hello 1</span><span>Goodbye 1</span></div>",
		);
		render(<div />, document.body);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		render(
			<div>
				<span>Hello 2</span>
				<span>Goodbye 2</span>
			</div>,
			document.body,
		);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(document.body.innerHTML).toEqual(
			"<div><span>Hello 1</span><span>Goodbye 2</span></div>",
		);
		cleanup();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual(
			"<div><span>Hello 2</span><span>Goodbye 2</span></div>",
		);
		render(
			<div>
				{null}
				<span>Goodbye 2</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual(
			"<div><span>Goodbye 2</span></div>",
		);
		render(
			<div>
				<span>Hello 3</span>
				<span>Goodbye 2</span>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual(
			"<div><span>Hello 3</span><span>Goodbye 2</span></div>",
		);
	});

	test("parents wait for async unmount", async () => {
		let cleanup!: () => unknown;
		async function* Component(this: Context, {message}: {message: string}) {
			if (cleanup !== undefined) {
				throw new Error("Rendered component twice");
			}

			try {
				for await ({message} of this) {
					yield (<span>{message}</span>);
				}
			} finally {
				await new Promise((resolve) => (cleanup = resolve));
			}
		}

		await render(
			<div>
				<Component message="Hello 1" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		const p = render(null, document.body);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		cleanup();
		await p;
		expect(document.body.innerHTML).toEqual("");
	});
});
