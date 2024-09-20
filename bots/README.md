# Silverback Example App

These apps are intended to be examples of how to work with your own deployment of the ApePay
protocol interacting your own infrastructure for a SaaS product, using Silverback for real-time
events. You can host these examples on the Silverback Cloud (https://silverback.apeworx.io) or
self-host.

## Stream Handling

ApePay has some different events that should trigger updates to your off-chain tracking of the
current status of a Stream, which should also affect the delivery of your product or service.

The lifecycle of a Stream starts with being created, after which funds can be added at any time to
extend the stream, and finally the Stream can be cancelled at any time (after an initial required
delay).

At each point in the Stream lifecycle, an update to an off-chain record should be created to ensure
consistency within your product and how it is managing aspects of your microservice architecture,
and your Silverback app can directly trigger changes in those other services or perform those
changes themselves.

One important thing to note is that while almost every part of the lifecycle has some sort of on-
chain action that occurs when a user performs an action, a Stream can also "run out of time" which
means you should notify your users as the deadline becomes near to prevent service interruptions,
and also necessitates performing "garbage collection" after the Streams run out completely in order
to remove the associated resources that are no longer being paid for (similar to when a Stream is
cancelled manually).

Lastly, it is important that you understand your own regulatory and reporting requirements and
implement those using a combination of specialized ApePay "validator" contracts as well as trigger-
ing manual cancellation (or review) of the services for breach of terms within your app.
These tasks require a key with access to the Owner role and may be best implemented as a separate
bot to ensure access control restrictions and not interfere with other running bots.

## Revenue Collection

One interesting perk of ApePay is that claiming a Stream (aka "earning revenue") is entirely left
to you as an action you can do at whatever frequency you desire (based on revenue cycles, gas
costs, etc.), and can integrate into other various parts of your revenue management systems, tax
tracking, or whatever else is needed to be accounted for (according to your business needs or
jurisdiction).

It is recommended that you implement this as a separate bot, as optimizing revenue operations can
be a great way to improve overall cost optimization, and also may require advanced access control
rights that your other microservices don't require. We provide an example here of what that might
look like within the example, however please note that a key that has the ability to make
transactions is required for production use.
