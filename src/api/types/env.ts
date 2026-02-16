export interface WorkerEnv {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
}

export interface ApiVariables {
	requestId: string;
}

export interface ApiBindings {
	Bindings: WorkerEnv;
	Variables: ApiVariables;
}
